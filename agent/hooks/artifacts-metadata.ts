/**
 * @file Artifacts Metadata Hook
 * @description 监听 artifact 相关 tool 的 action.result 事件，解析 metadata（observe-only）
 * @module agent/hooks/artifacts-metadata
 */

import { defineHook } from "eve/hooks";
import { toolResultFrom } from "eve/tools";
import createDocument from "../tools/create-document";
import editDocument from "../tools/edit-document";
import updateDocument from "../tools/update-document";

/**
 * Artifact Metadata Hook
 *
 * 监听 action.result 事件，筛选 create-document/edit-document/update-document 的返回值，
 * 解析 id、title、kind 等 metadata，仅用于服务端日志记录。
 *
 * 说明：自 EVE 迁移后，tool 直接调用 streamText 生成内容并返回结构化数据
 * { id, title, kind, content }，不再依赖 dataStream。前端通过
 * use-active-chat.tsx 的 useEffect 监听 tool result（part.type 为
 * tool-create-document/tool-edit-document/tool-update-document），
 * 从 part.output 解析数据并通过 SWR mutate 更新 artifact 状态。
 *
 * 注意：Hook 是 observe-only，不能修改 channel state 或写入 metadata。
 * artifact 状态更新已在前端 useEffect 中完成，此 hook 仅用于服务端观测/日志。
 */
export default defineHook({
  events: {
    /**
     * 处理 action.result 事件
     * 篮选 artifact 相关 tool 的返回值，解析 metadata
     *
     * @param event - action.result 事件数据
     * @param ctx - Hook 上下文，包含 session 信息
     */
    "action.result"(event, ctx) {
      // 篮选 create-document tool 的返回值
      const createResult = toolResultFrom(event.data.result, createDocument);
      if (createResult) {
        console.info("[artifacts-metadata] create-document result:", {
          sessionId: ctx.session.id,
          toolName: createResult.toolName,
          callId: createResult.callId,
          output: createResult.output,
        });

        // TODO: 如果 EVE 支持 hook 写入 channel metadata，在此处实现
        // 当前仅 observe，等待 EVE 文档更新
      }

      // 篮选 edit-document tool 的返回值
      const editResult = toolResultFrom(event.data.result, editDocument);
      if (editResult) {
        console.info("[artifacts-metadata] edit-document result:", {
          sessionId: ctx.session.id,
          toolName: editResult.toolName,
          callId: editResult.callId,
          output: editResult.output,
        });

        // TODO: 如果 EVE 支持 hook 写入 channel metadata，在此处实现
      }

      // 篮选 update-document tool 的返回值
      const updateResult = toolResultFrom(event.data.result, updateDocument);
      if (updateResult) {
        console.info("[artifacts-metadata] update-document result:", {
          sessionId: ctx.session.id,
          toolName: updateResult.toolName,
          callId: updateResult.callId,
          output: updateResult.output,
        });

        // TODO: 如果 EVE 支持 hook 写入 channel metadata，在此处实现
      }
    },
  },
});
