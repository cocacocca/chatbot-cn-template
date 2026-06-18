"use client";

import useSWR from "swr";
import { getMessagesByChatId } from "@/lib/queries/client/chat-queries";
import type { ChatMessage } from "@/lib/types";

// 用 SWR 拉取 chat 的消息列表
export function useChatMessages(chatId: string | null) {
  const { data, isLoading, error } = useSWR(
    chatId ? ["messages", chatId] : null,
    async () => {
      // chatId 在此处非 null（SWR key 非 null 时才调用 fetcher）
      const messages = await getMessagesByChatId(chatId as string);
      return messages as unknown as ChatMessage[];
    },
    { revalidateOnFocus: false }
  );

  return {
    messages: data,
    isLoading,
    error,
  };
}
