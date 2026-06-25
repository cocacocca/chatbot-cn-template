/** @file EVE 工具：对已存在的 artifact 执行整体重写（full rewrite），直接调用 LLM 生成新内容。 */
import { streamText } from "ai";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getDocumentById, saveDocument } from "@/lib/ai/artifacts-db";
import { getLanguageModel } from "@/lib/ai/providers";
import type { Document } from "@/lib/types";

/**
 * 生成更新文档的系统 prompt：将当前内容与变更描述组合，并按类型追加输出约束。
 *
 * @param document 待更新文档
 * @param description 变更描述
 * @returns 对应文档类型的系统 prompt
 */
function getUpdateSystemPrompt(
  document: Document,
  description: string
): string {
  const base = `You are updating a ${document.kind} document. The current content is:\n\n${document.content}\n\nImprove the document based on the user's request. Keep the style and format consistent. Output only the updated content, no explanations.`;
  const prompt = `${base}\n\nThe user's request: ${description}`;

  // code/sheet 类型强调只输出纯内容，避免围栏与解释
  if (document.kind === "code") {
    return `${prompt}\n\nOutput ONLY the complete updated code. No explanations, no markdown fences, no wrapping.`;
  }
  if (document.kind === "sheet") {
    return `${prompt}\n\nOutput ONLY the raw CSV data. No explanations, no markdown fences.`;
  }
  return prompt;
}

/**
 * 去除代码外层的 markdown 围栏（```）。
 * @param code - 可能包含围栏的原始代码字符串
 * @returns 去除围栏并 trim 后的纯代码字符串
 */
function stripFences(code: string): string {
  return code
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

/**
 * update_document EVE 工具。
 * 工具用途：对已有 artifact 进行整体重写。仅在大范围内容变更时使用，小范围修改应优先使用 editDocument。
 *
 * 输入 schema：
 * - id: 待重写 artifact 的 id
 * - description: 变更描述（默认 "Improve the content"）
 *
 * 执行流程：
 * 1. 读取文档并校验归属（userId 必须匹配 ctx.session.auth.current.principalId）
 * 2. 基于当前内容与变更描述调用 streamText 生成新内容
 * 3. 已登录用户将新版本落库
 * 4. 返回包含新内容的结构化数据
 *
 * @param args 工具输入，包含 id 与 description
 * @param ctx EVE 工具上下文，用于获取 session 中的用户 id
 * @returns 包含 id、title、kind、content 的对象；失败时返回 error 字段
 */
export default defineTool({
  description:
    "Full rewrite of an existing artifact. Only use for major changes where most content needs replacing. Prefer editDocument for targeted changes.",
  inputSchema: z.object({
    id: z.string().describe("The ID of the artifact to rewrite"),
    description: z
      .string()
      .default("Improve the content")
      .describe("The description of changes that need to be made"),
  }),
  async execute({ id, description }, ctx) {
    const document = await getDocumentById(id);
    const userId = ctx.session.auth.current?.principalId;

    // 文档不存在
    if (!document) {
      return {
        error: "Document not found",
      };
    }

    // 权限校验：仅文档所有者可重写
    if (document.userId !== userId) {
      return { error: "Forbidden" };
    }

    // 流式生成重写后的完整内容
    let draftContent = "";
    const { fullStream } = streamText({
      model: await getLanguageModel("default", userId),
      system: getUpdateSystemPrompt(document, description),
      prompt: description,
    });

    // 消费流：累积文本增量
    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
      }
    }

    // code 类型去除可能出现的 markdown 围栏
    if (document.kind === "code") {
      draftContent = stripFences(draftContent);
    }

    // 已登录用户才落库
    if (userId) {
      await saveDocument({
        id: document.id,
        title: document.title,
        kind: document.kind,
        content: draftContent,
        userId: document.userId,
      });
    }

    return {
      id,
      title: document.title,
      kind: document.kind,
      content: draftContent,
    };
  },
});
