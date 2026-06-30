/** @file EVE 工具：为已存在的文档请求写作建议（suggestions），调用 LLM 生成并持久化到数据库。 */
import { Output, streamText } from "ai";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getDocumentById, saveSuggestions } from "@/lib/ai/artifacts-db";
import { getLanguageModel } from "@/lib/ai/providers";
import { type AgentSuggestion, generateUUID } from "../lib/types";

/**
 * request_suggestions EVE 工具。
 * 工具用途：仅当用户显式要求对已创建的文档提供改进建议时调用，不用于一般问答。
 *
 * 输入 schema：
 * - documentId: 已存在文档 artifact 的 UUID
 *
 * 执行流程：
 * 1. 读取文档并校验归属（userId 必须匹配 ctx.session.auth.current.principalId）
 * 2. 调用 streamText 以结构化数组输出方式生成最多 5 条建议
 * 3. 已登录用户将建议批量持久化到 cct_suggestion 表
 * 4. 返回 { id, title, kind, suggestions } 结构化数据
 *
 * @param args 工具输入，包含 documentId
 * @param ctx EVE 工具上下文，用于获取 session 中的用户 id
 * @returns 包含 id、title、kind、suggestions 的对象；失败时返回 error 字段
 */
export default defineTool({
  description:
    "Request writing suggestions for an existing document artifact. Only use this when the user explicitly asks to improve or get suggestions for a document they have already created. Never use for general questions.",
  inputSchema: z.object({
    documentId: z
      .string()
      .describe(
        "The UUID of an existing document artifact that was previously created with createDocument"
      ),
  }),
  async execute({ documentId }, ctx) {
    const document = await getDocumentById(documentId);
    const userId = ctx.session.auth.current?.principalId;

    // 文档不存在或无内容
    if (!document?.content) {
      return {
        error: "Document not found",
      };
    }

    // 权限校验：仅文档所有者可请求建议
    if (document.userId !== userId) {
      return { error: "Forbidden" };
    }

    // 以结构化数组输出方式流式生成建议（每条含原句、建议句、说明）
    const { partialOutputStream } = streamText({
      model: await getLanguageModel("default", userId),
      system:
        "You are a writing assistant. Given a piece of writing, offer up to 5 suggestions to improve it. Each suggestion must contain full sentences, not just individual words. Describe what changed and why.",
      prompt: document.content,
      maxOutputTokens: 2048,
      output: Output.array({
        element: z.object({
          originalSentence: z.string().describe("The original sentence"),
          suggestedSentence: z.string().describe("The suggested sentence"),
          description: z.string().describe("The description of the suggestion"),
        }),
      }),
    });

    // 增量消费流式输出，累积完整建议列表
    const suggestions: Omit<
      AgentSuggestion,
      "userId" | "createdAt" | "documentCreatedAt"
    >[] = [];
    for await (const partialOutput of partialOutputStream) {
      if (!partialOutput) {
        continue;
      }

      // 仅处理新增元素，避免重复（已累积数量之前的元素跳过）
      for (let i = suggestions.length; i < partialOutput.length; i++) {
        const element = partialOutput[i];
        if (
          !element?.originalSentence ||
          !element?.suggestedSentence ||
          !element?.description
        ) {
          continue;
        }

        suggestions.push({
          originalText: element.originalSentence,
          suggestedText: element.suggestedSentence,
          description: element.description,
          id: generateUUID(),
          documentId,
          isResolved: false,
        });
      }
    }

    // 已登录用户将建议批量持久化
    if (userId) {
      await saveSuggestions({
        documentId,
        documentCreatedAt: document.createdAt,
        userId,
        suggestions: suggestions.map((suggestion) => ({
          originalText: suggestion.originalText,
          suggestedText: suggestion.suggestedText,
        })),
      });
    }

    return {
      id: documentId,
      title: document.title,
      kind: document.kind,
      suggestions,
    };
  },
});
