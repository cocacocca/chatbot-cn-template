/** @file AI 工具：创建新的 artifact（文档/脚本/表格），通过数据流向前端推送创建结果。 */
import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { ChatMessage, Session } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

/** createDocument 工具的构造参数。 */
type CreateDocumentProps = {
  /** 当前会话。 */
  session: Session;
  /** UI 消息数据流写入器，用于向前端推送 artifact 状态。 */
  dataStream: UIMessageStreamWriter<ChatMessage>;
  /** 用于生成内容的模型 id。 */
  modelId: string;
};

/**
 * 创建 createDocument AI 工具。
 * 工具用途：根据用户请求创建新的 artifact，并通过数据流通知前端实时展示。
 *
 * 输入 schema：
 * - title: artifact 标题
 * - kind: artifact 类型（code/text/sheet）
 *
 * 执行流程：
 * 1. 生成新 artifact 的 UUID
 * 2. 通过数据流推送 kind / id / title / clear 事件，通知前端初始化视图
 * 3. 根据 kind 查找对应的 document handler 并调用其 onCreateDocument
 * 4. 推送 finish 事件结束本次创建
 *
 * 返回值：包含 id、title、kind 与面向模型的简短确认信息
 */
export const createDocument = ({
  session,
  dataStream,
  modelId,
}: CreateDocumentProps) =>
  tool({
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
    execute: async ({ title, kind }) => {
      const id = generateUUID();

      // 推送 kind 事件：通知前端切换到对应 artifact 类型视图
      dataStream.write({
        type: "data-kind",
        data: kind,
        transient: true,
      });

      // 推送 id 事件：通知前端新 artifact 的唯一标识
      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      // 推送 title 事件：通知前端 artifact 标题
      dataStream.write({
        type: "data-title",
        data: title,
        transient: true,
      });

      // 推送 clear 事件：清空前端当前 artifact 内容，准备接收新内容
      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      // 根据 kind 查找对应的 document handler
      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      // 委托 handler 执行实际的文档创建（含模型调用与内容流式推送）
      await documentHandler.onCreateDocument({
        id,
        title,
        dataStream,
        session,
        modelId,
      });

      // 推送 finish 事件：通知前端本次创建结束
      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title,
        kind,
        content:
          kind === "code"
            ? "A script was created and is now visible to the user."
            : "A document was created and is now visible to the user.",
      };
    },
  });
