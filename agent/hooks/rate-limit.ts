/**
 * @file 速率限制 Hook
 * @description 订阅 session.started 事件，检查用户消息数量是否超限
 * @module agent/hooks/rate-limit
 */

import { defineHook } from "eve/hooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "../lib/types";

/**
 * 速率限制配置
 * 可通过环境变量 RATE_LIMIT_MAX_MESSAGES 配置，默认 100
 */
const RATE_LIMIT_MAX_MESSAGES =
  Number.parseInt(process.env.RATE_LIMIT_MAX_MESSAGES ?? "100", 10) || 100;

/**
 * 获取用户消息总数（最近 1 小时）
 * 直接使用 SQL 查询，绕过 RPC 函数的 auth.uid() 限制
 *
 * @param userId 用户 ID
 * @returns 用户消息总数
 */
async function getMessageCount(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // 需要通过 cct_chat 表过滤用户
  const { data: chats, error: chatError } = await supabase
    .from("cct_chat")
    .select("id")
    .eq("user_id", userId);

  if (chatError) {
    throw chatError;
  }

  // 统计该用户的消息数量
  const chatIds = chats?.map((c) => c.id) ?? [];
  if (chatIds.length === 0) {
    return 0;
  }

  const { count: userCount, error: userError } = await supabase
    .from("cct_message")
    .select("*", { count: "exact", head: true })
    .in("chat_id", chatIds)
    .gte("created_at", oneHourAgo);

  if (userError) {
    throw userError;
  }

  return userCount ?? 0;
}

/**
 * 速率限制 Hook
 *
 * 订阅 session.started 事件，在会话开始时检查用户消息数量。
 * 使用 getMessageCount(userId) 获取消息总数。
 * 超限时抛出错误（在 try-catch 之外），阻止请求继续执行。
 *
 * 错误处理策略：
 * - 数据库查询失败：fail-open（放行），仅记录错误，不阻止请求
 * - 速率限制超限：必须抛出错误让 EVE 阻止请求（throw 不可在 try-catch 内）
 */
export default defineHook({
  events: {
    /**
     * 处理 session.started 事件
     * 在会话开始时检查速率限制
     *
     * 错误处理策略：
     * - 数据库查询失败：fail-open（放行），仅记录错误，不阻止请求
     * - 速率限制超限：必须抛出错误（在 try-catch 之外），让 EVE 阻止请求
     *
     * 关键：超限 throw 必须在 try-catch 之外，否则会被同层 catch 吞没，
     * 导致速率限制完全失效。
     *
     * @param _event - session.started 事件数据
     * @param ctx - Hook 上下文，包含 session 信息
     */
    async "session.started"(_event, ctx) {
      const userId = ctx.session.auth.current?.principalId;

      // 未认证用户不检查速率限制
      if (!userId) {
        return;
      }

      // 非 UUID principalId（如 localDev 的 "local-dev"）跳过，避免 uuid 类型查询报错
      if (!isUuid(userId)) {
        return;
      }

      let messageCount: number;
      try {
        // 仅包裹数据库查询，超限判断移出 try-catch
        messageCount = await getMessageCount(userId);
      } catch (err) {
        // 数据库查询失败：fail-open（放行），不阻止请求
        console.error("[rate-limit] DB query failed, fail-open:", err);
        return;
      }

      // 超限必须抛出，移出 try-catch，让 EVE 阻止请求
      if (messageCount >= RATE_LIMIT_MAX_MESSAGES) {
        throw new Error(
          `Rate limit exceeded: You have sent ${messageCount} messages (limit: ${RATE_LIMIT_MAX_MESSAGES}).`
        );
      }
    },
  },
});
