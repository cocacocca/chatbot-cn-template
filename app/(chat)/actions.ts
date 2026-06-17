"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { deleteMessagesByChatIdAfterTimestamp } from "@/lib/ai/chat-db";
import { titlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";
import { createClient } from "@/lib/supabase/server";
import { getTextFromMessage } from "@/lib/utils";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
  userId,
}: {
  message: UIMessage;
  userId: string;
}) {
  const { text } = await generateText({
    model: await getTitleModel(userId),
    system: titlePrompt,
    prompt: getTextFromMessage(message),
  });
  return text
    .replace(/^[#*"\s]+/, "")
    .replace(/["]+$/, "")
    .trim();
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("Unauthorized");
  }

  // 使用 server client（受 RLS 保护），自动按用户隔离
  const { data: message, error: msgError } = await supabase
    .from("cct_message")
    .select("*")
    .eq("id", id)
    .single();

  if (msgError || !message) {
    throw new Error("Message not found");
  }

  const { data: chat } = await supabase
    .from("cct_chat")
    .select("*")
    .eq("id", message.chat_id)
    .single();

  if (!chat || chat.user_id !== user.id) {
    throw new Error("Unauthorized");
  }

  await deleteMessagesByChatIdAfterTimestamp(
    message.chat_id,
    new Date(message.created_at)
  );
}
