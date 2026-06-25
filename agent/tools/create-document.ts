/** @file EVE 工具：创建新的 artifact（文档/脚本/表格），直接调用 LLM 生成完整内容并返回结构化数据。 */
import { streamText } from "ai";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { saveDocument } from "@/lib/ai/artifacts-db";
import { getLanguageModel } from "@/lib/ai/providers";
import { artifactKinds } from "@/lib/artifacts/server";
import { generateUUID } from "@/lib/utils";

/**
 * 代码生成基础 prompt
 */
const codePrompt =
  "You are a code generator. Write clean, efficient, and well-structured code. Follow best practices and include appropriate comments.";

/**
 * 表格生成基础 prompt
 */
const sheetPrompt =
  "You are a spreadsheet generator. Generate clean, well-formatted CSV data. Use appropriate headers and data types.";

/**
 * 根据 artifact 类型返回创建文档时使用的系统 prompt。
 * - text: 生成 Markdown 文本
 * - code: 仅输出纯代码（无围栏、无解释）
 * - sheet: 仅输出原始 CSV 数据
 *
 * @param kind artifact 类型
 * @returns 对应类型的系统 prompt
 */
function getCreateSystemPrompt(kind: string): string {
  switch (kind) {
    case "code":
      return `${codePrompt}\n\nOutput ONLY the code. No explanations, no markdown fences, no wrapping.`;
    case "sheet":
      return `${sheetPrompt}\n\nOutput ONLY the raw CSV data. No explanations, no markdown fences.`;
    default:
      return "Write about the given topic. Markdown is supported. Use headings wherever appropriate.";
  }
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
 * create_document EVE 工具。
 * 工具用途：根据用户请求创建新的 artifact，直接调用 LLM 生成完整内容并返回结构化数据。
 *
 * 输入 schema：
 * - title: artifact 标题
 * - kind: artifact 类型（code/text/sheet）
 *
 * 执行流程：
 * 1. 生成新 artifact 的 UUID
 * 2. 根据 kind 选择对应的系统 prompt，调用 streamText 流式生成内容
 * 3. 消费流累积完整内容（code 类型需去除 markdown 围栏）
 * 4. 已登录用户将文档落库
 * 5. 返回 { id, title, kind, content } 结构化数据，供前端解析并展示
 *
 * @param args 工具输入，包含 title 与 kind
 * @param ctx EVE 工具上下文，用于获取 session 中的用户 id
 * @returns 包含 id、title、kind、content 的对象
 */
export default defineTool({
  description:
    "Create an artifact. You MUST specify kind: use 'code' for any programming/algorithm request (creates a script), 'text' for essays/writing (creates a document), 'sheet' for spreadsheets/data.",
  inputSchema: z.object({
    title: z.string().describe("The title of the artifact"),
    kind: z
      .enum(artifactKinds)
      .describe(
        "REQUIRED. 'code' for programming/algorithms, 'text' for essays/writing, 'sheet' for spreadsheets"
      ),
  }),
  async execute({ title, kind }, ctx) {
    const id = generateUUID();
    const userId = ctx.session.auth.current?.principalId;

    // 流式生成完整内容：按 kind 选择系统 prompt
    let draftContent = "";
    const { fullStream } = streamText({
      model: await getLanguageModel("default", userId),
      system: getCreateSystemPrompt(kind),
      prompt: title,
    });

    // 消费流：累积文本增量，得到完整内容
    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
      }
    }

    // code 类型去除可能出现的 markdown 围栏
    if (kind === "code") {
      draftContent = stripFences(draftContent);
    }

    // 已登录用户才落库（saveDocument 要求 userId 必填）
    if (userId) {
      await saveDocument({
        id,
        title,
        kind,
        content: draftContent,
        userId,
      });
    }

    return {
      id,
      title,
      kind,
      content: draftContent,
    };
  },
});
