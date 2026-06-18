/** @file AI 工具：对已存在的 artifact 执行精确查找替换（find-and-replace）编辑。 */
import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import { getDocumentById, saveDocument } from "@/lib/ai/artifacts-db";
import type { ChatMessage, Session } from "@/lib/types";

/** editDocument 工具的构造参数。 */
type EditDocumentProps = {
  /** 当前会话。 */
  session: Session;
  /** UI 消息数据流写入器，用于向前端推送编辑后的内容。 */
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

/**
 * 创建 editDocument AI 工具。
 * 工具用途：对已有 artifact 进行小范围精确编辑，通过 old_string → new_string 的查找替换实现。
 *
 * 输入 schema：
 * - id: 待编辑 artifact 的 id
 * - old_string: 需被替换的精确字符串（建议包含 3-5 行上下文以保证唯一匹配）
 * - new_string: 替换后的字符串
 * - replace_all: 是否替换全部匹配（默认 false，仅替换首个）
 *
 * 执行流程：
 * 1. 读取文档并校验归属（userId 必须匹配 session.user.id）
 * 2. 校验 old_string 存在于文档内容中
 * 3. 执行替换并保存为新版本
 * 4. 通过数据流推送编辑后的内容（按 kind 选择 code/sheet/text 通道）
 *
 * 返回值：包含 id、title、kind 与面向模型的简短确认信息；失败时返回 error 字段
 */
export const editDocument = ({ session, dataStream }: EditDocumentProps) =>
  tool({
    description:
      "Make a targeted edit to an existing artifact by finding and replacing an exact string. Preferred over updateDocument for small changes. The old_string must match exactly.",
    inputSchema: z.object({
      id: z.string().describe("The ID of the artifact to edit"),
      old_string: z
        .string()
        .describe(
          "Exact string to find. Include 3-5 surrounding lines for uniqueness."
        ),
      new_string: z.string().describe("Replacement string"),
      replace_all: z
        .boolean()
        .optional()
        .describe(
          "Replace all occurrences instead of just the first (default false)"
        ),
    }),
    execute: async ({ id, old_string, new_string, replace_all }) => {
      const document = await getDocumentById(id);

      // 文档不存在
      if (!document) {
        return { error: "Document not found" };
      }

      // 权限校验：仅文档所有者可编辑
      if (document.userId !== session.user?.id) {
        return { error: "Forbidden" };
      }

      // 文档内容为空，无法执行查找替换
      if (!document.content) {
        return { error: "Document has no content" };
      }

      // 校验 old_string 在文档中存在
      if (!document.content.includes(old_string)) {
        return { error: "old_string not found in document" };
      }

      // 根据 replace_all 决定替换首个或全部匹配
      const updated = replace_all
        ? document.content.replaceAll(old_string, new_string)
        : document.content.replace(old_string, new_string);

      // 保存编辑后的内容（作为新版本写入数据库）
      await saveDocument({
        id: document.id,
        title: document.title,
        kind: document.kind,
        content: updated,
        userId: document.userId,
      });

      // 推送 clear 事件：通知前端清空当前 artifact 内容
      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      // 按 kind 选择对应的数据通道推送编辑后的完整内容
      if (document.kind === "code") {
        dataStream.write({
          type: "data-codeDelta",
          data: updated,
          transient: true,
        });
      } else if (document.kind === "sheet") {
        dataStream.write({
          type: "data-sheetDelta",
          data: updated,
          transient: true,
        });
      } else {
        dataStream.write({
          type: "data-textDelta",
          data: updated,
          transient: true,
        });
      }

      // 推送 finish 事件：通知前端本次编辑结束
      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content:
          document.kind === "code"
            ? "The script has been edited successfully."
            : "The document has been edited successfully.",
      };
    },
  });
