/** @file AI 工具：为已存在的文档请求写作建议（suggestions），通过流式输出推送给前端并持久化到数据库。 */
import { Output, streamText, tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import { getDocumentById, saveSuggestions } from "@/lib/ai/artifacts-db";
import type { ChatMessage, Session, Suggestion } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { getLanguageModel } from "../providers";

/** requestSuggestions 工具的构造参数。 */
type RequestSuggestionsProps = {
  /** 当前会话。 */
  session: Session;
  /** UI 消息数据流写入器，用于向前端推送建议。 */
  dataStream: UIMessageStreamWriter<ChatMessage>;
  /** 用于生成建议的模型 id。 */
  modelId: string;
};

/**
 * 创建 requestSuggestions AI 工具。
 * 工具用途：仅当用户显式要求对已创建的文档提供改进建议时调用，不用于一般问答。
 *
 * 输入 schema：
 * - documentId: 已存在文档 artifact 的 UUID
 *
 * 执行流程：
 * 1. 读取文档并校验归属（userId 必须匹配 session.user.id）
 * 2. 调用 streamText 流式生成最多 5 条建议（每条含原句、建议句、说明）
 * 3. 增量消费流式输出：每解析出一条完整建议即推送 data-suggestion 事件给前端
 * 4. 全部解析完成后，将建议批量持久化到 cct_suggestion 表
 *
 * 返回值：包含 id、title、kind 与面向模型的简短确认信息；失败时返回 error 字段
 */
export const requestSuggestions = ({
  session,
  dataStream,
  modelId,
}: RequestSuggestionsProps) =>
  tool({
    description:
      "Request writing suggestions for an existing document artifact. Only use this when the user explicitly asks to improve or get suggestions for a document they have already created. Never use for general questions.",
    inputSchema: z.object({
      documentId: z
        .string()
        .describe(
          "The UUID of an existing document artifact that was previously created with createDocument"
        ),
    }),
    execute: async ({ documentId }) => {
      const document = await getDocumentById(documentId);

      // 文档不存在或无内容
      if (!document?.content) {
        return {
          error: "Document not found",
        };
      }

      // 权限校验：仅文档所有者可请求建议
      if (document.userId !== session.user?.id) {
        return { error: "Forbidden" };
      }

      // 累积已生成的建议（不含 userId/createdAt/documentCreatedAt，由 saveSuggestions 补齐）
      const suggestions: Omit<
        Suggestion,
        "userId" | "createdAt" | "documentCreatedAt"
      >[] = [];

      // 调用模型流式生成结构化建议数组
      const { partialOutputStream } = streamText({
        model: await getLanguageModel(modelId, session.user.id),
        system:
          "You are a writing assistant. Given a piece of writing, offer up to 5 suggestions to improve it. Each suggestion must contain full sentences, not just individual words. Describe what changed and why.",
        prompt: document.content,
        output: Output.array({
          element: z.object({
            originalSentence: z.string().describe("The original sentence"),
            suggestedSentence: z.string().describe("The suggested sentence"),
            description: z
              .string()
              .describe("The description of the suggestion"),
          }),
        }),
      });

      // 增量消费流式输出：processedCount 记录已处理索引，避免重复推送
      let processedCount = 0;
      for await (const partialOutput of partialOutputStream) {
        if (!partialOutput) {
          continue;
        }

        // 仅处理本次新增的元素（之前已处理的跳过）
        for (let i = processedCount; i < partialOutput.length; i++) {
          const element = partialOutput[i];
          // 字段不完整时跳过，等待后续 chunk 补全
          if (
            !element?.originalSentence ||
            !element?.suggestedSentence ||
            !element?.description
          ) {
            continue;
          }

          const suggestion = {
            originalText: element.originalSentence,
            suggestedText: element.suggestedSentence,
            description: element.description,
            id: generateUUID(),
            documentId,
            isResolved: false,
          };

          // 推送单条建议给前端
          dataStream.write({
            type: "data-suggestion",
            data: suggestion as Suggestion,
            transient: true,
          });

          suggestions.push(suggestion);
          processedCount++;
        }
      }

      // 将建议批量持久化到数据库
      if (session.user?.id) {
        const userId = session.user.id;

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
        message: "Suggestions have been added to the document",
      };
    },
  });
