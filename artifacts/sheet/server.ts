/** @file 电子表格 Artifact 服务端处理器，负责基于 LLM 流式生成与更新 CSV 内容 */
import { streamText } from "ai";
import { sheetPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const sheetDocumentHandler = createDocumentHandler<"sheet">({
  kind: "sheet",
  // 创建文档：基于标题流式生成 CSV 数据
  onCreateDocument: async ({ title, dataStream, modelId, session }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: await getLanguageModel(modelId, session.user.id),
      system: `${sheetPrompt}\n\nOutput ONLY the raw CSV data. No explanations, no markdown fences.`,
      prompt: title,
    });

    // 消费流：将文本增量累积并写入 dataStream
    for await (const delta of fullStream) {
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

    const { fullStream } = streamText({
      model: await getLanguageModel(modelId, session.user.id),
      system: `${updateDocumentPrompt(document.content, "sheet")}\n\nOutput ONLY the raw CSV data. No explanations, no markdown fences.`,
      prompt: description,
    });

    for await (const delta of fullStream) {
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
