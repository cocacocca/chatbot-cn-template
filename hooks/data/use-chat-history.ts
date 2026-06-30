/** @file 聊天历史列表 Hook，基于 SWR 拉取会话摘要 */
"use client";

import useSWR from "swr";
import { getChats } from "@/lib/queries/client/chat-queries";
import type { ChatSummary } from "@/lib/queries/client/types";

/**
 * 聊天历史 Hook
 *
 * 拉取当前用户的会话摘要列表，重连时自动重新验证，
 * 切换窗口焦点时不重新请求。
 *
 * @param limit 返回的最大会话数量，默认 100
 * @returns SWR 返回值，包含会话摘要数组及加载/错误状态
 */
export function useChatHistory(limit = 100) {
  return useSWR<ChatSummary[]>("chat-history", () => getChats(limit), {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });
}
