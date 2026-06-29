/**
 * @file 会话标题生成 Hook
 * @description 订阅 session.started 事件，异步生成会话标题
 * @module agent/hooks/generate-title
 */

import { generateText } from "ai";
import { defineHook } from "eve/hooks";
import { getTitleModel } from "@/lib/ai/providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "../lib/types";

/**
 * 会话标题生成 Hook
 *
 * 订阅 session.started 事件，在会话开始时异步生成标题。
 * 使用 getTitleModel(userId) 获取标题生成模型。
 * 标题生成失败时保留默认标题（"New Chat"），不影响主流程。
 *
 * 使用 try-catch 防止失败影响主流程。
 */
export default defineHook({
  events: {
    /**
     * 处理 session.started 事件
     * 在会话开始时异步生成标题
     *
     * @param _event - session.started 事件数据
     * @param ctx - Hook 上下文，包含 session 信息
     */
    async "session.started"(_event, ctx) {
      const userId = ctx.session.auth.current?.principalId;
      const sessionId = ctx.session.id;

      // 未认证用户不生成标题
      if (!userId) {
        return;
      }

      // 非 UUID principalId（如 localDev 的 "local-dev"）跳过，避免 uuid 类型查询报错
      if (!isUuid(userId)) {
        return;
      }

      try {
        // 获取标题生成模型
        const titleModel = await getTitleModel(userId);

        // 生成标题（使用简单 prompt）
        // AI SDK 7 beta 不支持 maxTokens，通过 prompt 约束长度
        const { text } = await generateText({
          model: titleModel,
          prompt:
            "Generate a short, concise title (max 50 chars) for a new chat session. Just output the title, nothing else.",
        });

        const title = text.trim().slice(0, 50) || "New Chat";

        // 更新数据库中的标题
        const supabase = createAdminClient();
        const { error } = await supabase
          .from("cct_chat")
          .update({ title })
          .eq("id", sessionId);

        if (error) {
          console.error("[generate-title] Failed to update title:", error);
          // 不抛出错误，保留默认标题
        }
      } catch (err) {
        // 标题生成失败时保留默认标题，不影响主流程
        console.error("[generate-title] Failed to generate title:", err);
      }
    },
  },
});
