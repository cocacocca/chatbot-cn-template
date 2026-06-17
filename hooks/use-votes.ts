"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Vote } from "@/lib/types";

export function useVotes(chatId: string) {
  const supabase = createClient();

  return useSWR<Vote[]>(chatId ? ["votes", chatId] : null, async () => {
    const { data, error } = await supabase
      .from("vote")
      .select("chat_id, message_id, is_upvoted")
      .eq("chat_id", chatId);

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      chatId: row.chat_id,
      messageId: row.message_id,
      isUpvoted: row.is_upvoted,
    }));
  });
}

// 客户端版本，命名为 voteMessageClient 以避免与 lib/db/server-queries.ts
// 中的服务端 voteMessage（server-only，对象参数）混淆。
export async function voteMessageClient(
  chatId: string,
  messageId: string,
  isUpvoted: boolean
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("vote")
    .upsert(
      { chat_id: chatId, message_id: messageId, is_upvoted: isUpvoted },
      { onConflict: "chat_id,message_id" }
    );

  if (error) {
    throw error;
  }
}
