/**
 * @file 消息持久化 Hook
 * @description 订阅 message.completed 和 turn.completed 事件，将消息持久化到数据库
 * @module agent/hooks/persist-messages
 */

import { defineHook } from "eve/hooks";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { generateUUID, isUuid } from "../lib/types";

/**
 * 消息持久化 Hook
 *
 * 使用 admin client（绕过 RLS）将消息写入数据库。
 * 订阅双事件：
 * - message.completed：每条消息完成时立即写入（upsert 策略避免重复）
 * - turn.completed：turn 结束时作为兜底，确保所有消息已写入
 *
 * 使用 ctx.session.auth.current?.principalId 获取用户 ID，
 * 使用 ctx.session.id 作为会话 ID（对应数据库 cct_chat.id）。
 */
export default defineHook({
  events: {
    /**
     * 处理 message.completed 事件
     * 每条消息完成时立即写入数据库（upsert 策略）
     *
     * @param event - message.completed 事件数据
     * @param ctx - Hook 上下文，包含 session 信息
     */
    async "message.completed"(event, ctx) {
      const userId = ctx.session.auth.current?.principalId;
      const sessionId = ctx.session.id;

      // 未认证用户（如内部 runtime 调用）不持久化
      if (!userId) {
        return;
      }

      // 非 UUID principalId（如 localDev 的 "local-dev"）跳过，避免 uuid 类型列读写报错
      if (!isUuid(userId)) {
        return;
      }

      const supabase = createAdminClient();

      // 1. 确保 cct_chat 记录存在（upsert）
      const { error: chatError } = await supabase.from("cct_chat").upsert(
        {
          id: sessionId,
          user_id: userId,
          title: "New Chat", // 默认标题，后续由 generate-title hook 更新
        },
        { onConflict: "id" }
      );

      if (chatError) {
        console.error("[persist-messages] Failed to upsert chat:", chatError);
        throw chatError; // 抛出错误以触发 turn.failed
      }

      // 2. 写入消息（upsert 策略避免重复）
      const messageData = event.data;
      const messageRow = {
        id: generateUUID(), // 生成唯一消息 ID
        chat_id: sessionId,
        role: "assistant", // message.completed 事件来自 assistant
        parts: (messageData.message ?? null) as Json | null,
        attachments: null as Json | null,
        created_at: new Date().toISOString(),
      };

      const { error: messageError } = await supabase
        .from("cct_message")
        .upsert(messageRow, { onConflict: "id" });

      if (messageError) {
        console.error(
          "[persist-messages] Failed to upsert message:",
          messageError
        );
        throw messageError;
      }
    },

    /**
     * 处理 turn.completed 事件
     * turn 结束时作为兜底，确保所有消息已写入
     *
     * @param _event - turn.completed 事件数据
     * @param ctx - Hook 上下文
     */
    async "turn.completed"(_event, ctx) {
      const userId = ctx.session.auth.current?.principalId;
      const sessionId = ctx.session.id;

      if (!userId) {
        return;
      }

      // 非 UUID principalId（如 localDev 的 "local-dev"）跳过，避免 uuid 类型列读写报错
      if (!isUuid(userId)) {
        return;
      }

      // turn.completed 作为兜底，确保 cct_chat 存在
      // 实际消息已在 message.completed 中写入，此处仅做一致性检查
      const supabase = createAdminClient();
      const { error } = await supabase.from("cct_chat").upsert(
        {
          id: sessionId,
          user_id: userId,
          title: "New Chat",
        },
        { onConflict: "id" }
      );

      if (error) {
        console.error(
          "[persist-messages] Failed to ensure chat on turn.completed:",
          error
        );
        // 不抛出错误，避免影响 turn.completed 流程
      }
    },
  },
});
