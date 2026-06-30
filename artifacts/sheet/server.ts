/** @file 电子表格 Artifact 服务端处理器，负责基于 LLM 流式生成与更新 CSV 内容 */
import { streamText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

/**
 * 表格生成 prompt
 */
const sheetPrompt =
  "You are a spreadsheet generator. Generate clean, well-formatted CSV data. Use appropriate headers and data types.";

/**
 * 生成更新文档的 prompt
 * @param content - 当前文档内容
 * @param kind - 文档类型
 * @returns 系统 prompt
 */
function getUpdateDocumentPrompt(content: string, kind: string): string {
  return `You are updating a ${kind} document. The current content is:\n\n${content}\n\nImprove the document based on the user's request. Keep the style and format consistent. Output only the updated content, no explanations.`;
}

export const sheetDocumentHandler = createDocumentHandler<"sheet">({
  kind: "sheet",
  // 创建文档：基于标题流式生成 CSV 数据
  onCreateDocument: async ({ title, dataStream, modelId, session }) => {
    let draftContent = "";

    const { stream } = streamText({
      model: await getLanguageModel(modelId, session.user.id),
      system: `${sheetPrompt}\n\nOutput ONLY the raw CSV data. No explanations, no markdown fences.`,
      prompt: title,
      maxOutputTokens: 8192,
    });

    // 消费流：将文本增量累积并写入 dataStream
    for await (const delta of stream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-sheetDelta",
          data: draftContent,
          transient: true,
        });
      }
    }

    return draftContent;
  },
  // 更新文档：基于描述与现有内容流式生成新 CSV
  onUpdateDocument: async ({
    document,
    description,
    dataStream,
    modelId,
    session,
  }) => {
    let draftContent = "";

    const { stream } = streamText({
      model: await getLanguageModel(modelId, session.user.id),
      system: `${getUpdateDocumentPrompt(document.content, "sheet")}\n\nOutput ONLY the raw CSV data. No explanations, no markdown fences.`,
      prompt: description,
      maxOutputTokens: 8192,
    });

    for await (const delta of stream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-sheetDelta",
          data: draftContent,
          transient: true,
        });
      }
    }

    return draftContent;
  },
});
