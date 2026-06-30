/**
 * @file 会话标题生成 Hook
 * @description 订阅 message.received 事件，基于用户首条消息异步生成会话标题
 *
 *   设计要点：
 *   - 订阅 message.received（用户发消息时触发），而非 session.started
 *     原因：session.started 时无对话内容，只能生成空泛标题；
 *     message.received 携带用户实际消息，可基于内容生成有意义的标题
 *   - 仅当当前标题为默认值 "New Chat" 时才生成，避免每条消息都重新生成
 *     这样只在会话首条用户消息时触发一次标题更新
 *   - 标题生成失败时保留默认标题，不影响主流程
 *
 * @module agent/hooks/generate-title
 */

import { generateText, Output } from "ai";
import { defineHook } from "eve/hooks";
import { z } from "zod";
import { getTitleModel } from "@/lib/ai/providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "../lib/types";

/**
 * 标题结构化输出 schema
 * max(80) 留余量，最终落库前再 slice(0, 50) 兜底
 */
const titleSchema = z.object({
  title: z.string().max(80),
});

/**
 * 默认标题常量，用于判断是否需要生成新标题
 */
const DEFAULT_TITLE = "New Chat";

/**
 * 会话标题生成 Hook
 *
 * 订阅 message.received 事件，在用户发送消息时异步生成标题。
 * 仅当当前标题仍为默认值 "New Chat" 时才生成，避免每条消息都重新生成。
 * 使用 getTitleModel(userId) 获取标题生成模型。
 * 标题生成失败时保留默认标题，不影响主流程。
 *
 * AI SDK 7 正式支持 Output.* 结构化输出与 maxOutputTokens，
 * 替代旧版"通过 prompt 约束长度"的临时方案。
 */
export default defineHook({
  events: {
    /**
     * 处理 message.received 事件
     * 在用户发送消息时，基于消息内容异步生成标题
     *
     * @param event - message.received 事件数据，包含用户消息内容
     *   - event.data.message: string - 用户消息文本
     *   - event.data.sequence: number - 消息序号
     *   - event.data.turnId: string - 轮次 ID
     * @param ctx - Hook 上下文，包含 session 信息
     */
    async "message.received"(event, ctx) {
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

      // 提取用户消息内容
      const userMessage = event.data.message;
      if (!userMessage || typeof userMessage !== "string") {
        return;
      }

      try {
        const supabase = createAdminClient();

        // 仅当当前标题为默认值时才生成新标题，避免每条消息都重新生成
        const { data: chat, error: queryError } = await supabase
          .from("cct_chat")
          .select("title")
          .eq("id", sessionId)
          .maybeSingle();

        if (queryError) {
          console.error(
            "[generate-title] Failed to query current title:",
            queryError
          );
          return;
        }

        // 会话不存在或标题已非默认值，跳过生成
        if (!chat || chat.title !== DEFAULT_TITLE) {
          return;
        }

        // 获取标题生成模型
        const titleModel = await getTitleModel(userId);

        // 生成标题：使用 Output.* 结构化输出 + 显式 maxOutputTokens
        // 基于用户首条消息内容生成，比 session.started 时的空泛标题更有意义
        const { output } = await generateText({
          model: titleModel,
          prompt: `Generate a short, concise title (max 50 chars) for a chat session based on the user's first message. Just output the title, nothing else.\n\nUser message: ${userMessage}`,
          output: Output.object({ schema: titleSchema }),
          maxOutputTokens: 100,
        });

        // 结构化输出可能为空（模型拒答/截断），兜底默认标题
        const title = output?.title?.trim().slice(0, 50) || DEFAULT_TITLE;

        // 更新数据库中的标题
        const { error: updateError } = await supabase
          .from("cct_chat")
          .update({ title })
          .eq("id", sessionId);

        if (updateError) {
          console.error(
            "[generate-title] Failed to update title:",
            updateError
          );
          // 不抛出错误，保留默认标题
        }
      } catch (err) {
        // 标题生成失败时保留默认标题，不影响主流程
        console.error("[generate-title] Failed to generate title:", err);
      }
    },
  },
});
