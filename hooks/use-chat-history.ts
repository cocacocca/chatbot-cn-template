"use client";

import useSWR from "swr";
import { getChats } from "@/lib/queries/client/chat-queries";
import type { ChatSummary } from "@/lib/queries/client/types";

export function useChatHistory(limit = 100) {
  return useSWR<ChatSummary[]>("chat-history", () => getChats(limit), {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });
}
