/** @file 代码 Artifact 服务端处理器，负责基于 LLM 流式生成与更新代码内容 */
import { streamText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

/**
 * 代码生成 prompt
 */
const codePrompt =
  "You are a code generator. Write clean, efficient, and well-structured code. Follow best practices and include appropriate comments.";

/**
 * 生成更新文档的 prompt
 * @param content - 当前文档内容
 * @param kind - 文档类型
 * @returns 系统 prompt
 */
function getUpdateDocumentPrompt(content: string, kind: string): string {
  return `You are updating a ${kind} document. The current content is:\n\n${content}\n\nImprove the document based on the user's request. Keep the style and format consistent. Output only the updated content, no explanations.`;
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

export const codeDocumentHandler = createDocumentHandler<"code">({
  kind: "code",
  // 创建文档：基于标题流式生成代码
  onCreateDocument: async ({ title, dataStream, modelId, session }) => {
    let draftContent = "";

    const { stream } = streamText({
      model: await getLanguageModel(modelId, session.user.id),
      system: `${codePrompt}\n\nOutput ONLY the code. No explanations, no markdown fences, no wrapping.`,
      prompt: title,
      maxOutputTokens: 8192,
    });

    // 消费流：将文本增量写入 dataStream，并实时去除围栏
    for await (const delta of stream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-codeDelta",
          data: stripFences(draftContent),
          transient: true,
        });
      }
    }

    return stripFences(draftContent);
  },
  // 更新文档：基于描述与现有内容流式生成新代码
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
      system: `${getUpdateDocumentPrompt(document.content, "code")}\n\nOutput ONLY the complete updated code. No explanations, no markdown fences, no wrapping.`,
      prompt: description,
      maxOutputTokens: 8192,
    });

    for await (const delta of stream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-codeDelta",
          data: stripFences(draftContent),
          transient: true,
        });
      }
    }

    return stripFences(draftContent);
  },
});
