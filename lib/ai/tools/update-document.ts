/** @file AI 工具：对已存在的 artifact 执行整体重写（full rewrite），适用于大部分内容需要变更的场景。 */
import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import { getDocumentById } from "@/lib/ai/artifacts-db";
import { documentHandlersByArtifactKind } from "@/lib/artifacts/server";
import type { ChatMessage, Session } from "@/lib/types";

/** updateDocument 工具的构造参数。 */
type UpdateDocumentProps = {
  /** 当前会话。 */
  session: Session;
  /** UI 消息数据流写入器，用于向前端推送重写后的内容。 */
  dataStream: UIMessageStreamWriter<ChatMessage>;
  /** 用于生成重写内容的模型 id。 */
  modelId: string;
};

/**
 * 创建 updateDocument AI 工具。
 * 工具用途：对已有 artifact 进行整体重写。仅在大范围内容变更时使用，小范围修改应优先使用 editDocument。
 *
 * 输入 schema：
 * - id: 待重写 artifact 的 id
 * - description: 变更描述（默认 "Improve the content"）
 *
 * 执行流程：
 * 1. 读取文档并校验归属（userId 必须匹配 session.user.id）
 * 2. 推送 clear 事件清空前端当前内容
 * 3. 根据 kind 查找对应的 document handler 并调用其 onUpdateDocument
 * 4. 推送 finish 事件结束本次重写
 *
 * 返回值：包含 id、title、kind 与面向模型的简短确认信息；失败时返回 error 字段
 */
export const updateDocument = ({
  session,
  dataStream,
  modelId,
}: UpdateDocumentProps) =>
  tool({
    description:
      "Full rewrite of an existing artifact. Only use for major changes where most content needs replacing. Prefer editDocument for targeted changes.",
    inputSchema: z.object({
      id: z.string().describe("The ID of the artifact to rewrite"),
      description: z
        .string()
        .default("Improve the content")
        .describe("The description of changes that need to be made"),
    }),
    execute: async ({ id, description }) => {
      const document = await getDocumentById(id);

      // 文档不存在
      if (!document) {
        return {
          error: "Document not found",
        };
      }

      // 权限校验：仅文档所有者可重写
      if (document.userId !== session.user?.id) {
        return { error: "Forbidden" };
      }

      // 推送 clear 事件：通知前端清空当前 artifact 内容，准备接收重写内容
      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      // 根据 kind 查找对应的 document handler
      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      // 委托 handler 执行实际的重写（含模型调用与内容流式推送）
      await documentHandler.onUpdateDocument({
        document,
        description,
        dataStream,
        session,
        modelId,
      });

      // 推送 finish 事件：通知前端本次重写结束
      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content:
          document.kind === "code"
            ? "The script has been updated successfully."
            : "The document has been updated successfully.",
      };
    },
  });
