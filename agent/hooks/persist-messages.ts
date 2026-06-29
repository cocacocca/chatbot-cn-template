/**
 * @file 消息持久化 Hook
 * @description 订阅 message.received、message.completed、turn.completed 三个事件，
 *              将用户与 assistant 消息持久化到 cct_message 表
 * @module agent/hooks/persist-messages
 */

import { defineHook } from "eve/hooks";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { generateUUID, isUuid } from "../lib/types";

/**
 * 确保 cct_chat 记录存在（upsert by id）
 *
 * @param supabase - 已实例化的 supabase admin client
 * @param sessionId - 会话 ID（对应 cct_chat.id）
 * @param userId - 用户 UUID
 * @throws {PostgrestError} upsert 失败时抛出，触发 turn.failed
 */
async function ensureChat(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase.from("cct_chat").upsert(
    {
      id: sessionId,
      user_id: userId,
      title: "New Chat", // 默认标题，由 generate-title hook 后续更新
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[persist-messages] Failed to upsert chat:", error);
    throw error;
  }
}

/**
 * 消息持久化 Hook
 *
 * 使用 admin client（绕过 RLS）将消息写入数据库。订阅三个事件覆盖完整消息生命周期：
 * - message.received：用户消息进入时写入（role="user"）
 * - message.completed：assistant 消息完成时写入（role="assistant"）
 * - turn.completed：turn 结束兜底，仅确保 cct_chat 存在
 *
 * 实现说明：
 * 1. EVE 0.17.0 事件流不携带稳定 message id（无 id 字段），因此采用 insert 而非
 *    upsert。重复消费（如重放）需由消费端去重或上游会话级幂等保证。
 * 2. message.completed 事件固定对应 assistant 消息（事件无 role 字段）。
 * 3. 使用 ctx.session.auth.current?.principalId 获取用户 ID，
 *    使用 ctx.session.id 作为会话 ID（对应数据库 cct_chat.id）。
 */
export default defineHook({
  events: {
    /**
     * 处理 message.received 事件
     * 用户消息进入时立即写入（role="user"）
     *
     * @param event - message.received 事件，data.message 为用户输入文本
     * @param ctx - Hook 上下文，包含 session 信息
     */
    async "message.received"(event, ctx) {
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
      await ensureChat(supabase, sessionId, userId);

      // 写入用户消息（事件结构：{ message: string, sequence, turnId }）
      const data = event.data;
      const messageRow = {
        id: generateUUID(),
        chat_id: sessionId,
        role: "user" as const,
        parts: data.message as Json,
        attachments: null as Json | null,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("cct_message").insert(messageRow);

      if (error) {
        console.error(
          "[persist-messages] Failed to insert user message:",
          error
        );
        throw error;
      }
    },

    /**
     * 处理 message.completed 事件
     * assistant 消息完成时写入（role="assistant"）
     *
     * @param event - message.completed 事件，data.message 为 assistant 输出文本（可能为 null）
     * @param ctx - Hook 上下文，包含 session 信息
     */
    async "message.completed"(event, ctx) {
      const userId = ctx.session.auth.current?.principalId;
      const sessionId = ctx.session.id;

      if (!userId) {
        return;
      }

      if (!isUuid(userId)) {
        return;
      }

      const supabase = createAdminClient();
      await ensureChat(supabase, sessionId, userId);

      // 写入 assistant 消息
      // 事件结构：{ finishReason, message: string|null, sequence, stepIndex, turnId }
      const data = event.data;
      const messageRow = {
        id: generateUUID(),
        chat_id: sessionId,
        role: "assistant" as const,
        parts: (data.message ?? null) as Json | null,
        attachments: null as Json | null,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("cct_message").insert(messageRow);

      if (error) {
        console.error(
          "[persist-messages] Failed to insert assistant message:",
          error
        );
        throw error;
      }
    },

    /**
     * 处理 turn.completed 事件
     * turn 结束时作为兜底，仅确保 cct_chat 存在（实际消息已在上述事件中写入）
     *
     * @param _event - turn.completed 事件数据（未使用）
     * @param ctx - Hook 上下文
     */
    async "turn.completed"(_event, ctx) {
      const userId = ctx.session.auth.current?.principalId;
      const sessionId = ctx.session.id;

      if (!userId) {
        return;
      }

      if (!isUuid(userId)) {
        return;
      }

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
