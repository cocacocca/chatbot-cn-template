"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { deleteMessagesByChatIdAfterTimestamp } from "@/lib/ai/chat-db";
import { titlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTextFromMessage } from "@/lib/utils";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text } = await generateText({
    model: await getTitleModel(),
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

  const adminClient = createAdminClient();
  const { data: message, error: msgError } = await adminClient
    .from("cct_message")
    .select("*")
    .eq("id", id)
    .single();

  if (msgError || !message) {
    throw new Error("Message not found");
  }

  const { data: chat } = await adminClient
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

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("Unauthorized");
  }

  const adminClient = createAdminClient();
  const { data: chat } = await adminClient
    .from("cct_chat")
    .select("*")
    .eq("id", chatId)
    .single();

  if (!chat || chat.user_id !== user.id) {
    throw new Error("Unauthorized");
  }

  const { error } = await adminClient
    .from("cct_chat")
    .update({ visibility })
    .eq("id", chatId);
  if (error) {
    throw error;
  }
}
