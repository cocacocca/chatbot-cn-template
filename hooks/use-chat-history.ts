"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Chat } from "@/lib/types";

export function useChatHistory(limit = 100) {
  const supabase = createClient();

  return useSWR<Chat[]>(
    "chat-history",
    async () => {
      const { data, error } = await supabase
        .from("cct_chat")
        .select("id, title, visibility, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        visibility: row.visibility,
        createdAt: row.created_at,
      }));
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );
}
