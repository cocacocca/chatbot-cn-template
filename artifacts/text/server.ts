/** @file 文本 Artifact 服务端处理器，负责基于 LLM 流式生成与更新 Markdown 文本 */
import { smoothStream, streamText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

/**
 * 生成更新文档的 prompt
 * @param content - 当前文档内容
 * @param kind - 文档类型
 * @returns 系统 prompt
 */
function getUpdateDocumentPrompt(content: string, kind: string): string {
  return `You are updating a ${kind} document. The current content is:\n\n${content}\n\nImprove the document based on the user's request. Keep the style and format consistent. Output only the updated content, no explanations.`;
}

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  // 创建文档：基于标题流式生成 Markdown 文本，启用按词平滑流式输出
  onCreateDocument: async ({ title, dataStream, modelId, session }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: await getLanguageModel(modelId, session.user.id),
      system:
        "Write about the given topic. Markdown is supported. Use headings wherever appropriate.",
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: title,
    });

    // 消费流：将文本增量逐字写入 dataStream
    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-textDelta",
          data: delta.text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
  // 更新文档：基于描述与现有内容流式生成新文本
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
      system: getUpdateDocumentPrompt(document.content, "text"),
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: description,
    });

    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-textDelta",
          data: delta.text,
          transient: true,
        });
      }
    }

    return draftContent;
  },
});
