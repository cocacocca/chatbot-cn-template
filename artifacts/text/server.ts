/** @file 文本 Artifact 服务端处理器，负责基于 LLM 流式生成与更新 Markdown 文本 */
import { smoothStream, streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

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
      system: updateDocumentPrompt(document.content, "text"),
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
