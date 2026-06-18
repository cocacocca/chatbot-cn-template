/** @file 聊天相关的服务端 actions：保存模型 cookie、生成对话标题、删除尾部消息 */
"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { deleteMessagesByChatIdAfterTimestamp } from "@/lib/ai/chat-db";
import { titlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";
import { createClient } from "@/lib/supabase/server";
import { getTextFromMessage } from "@/lib/utils";

/**
 * 将用户选择的聊天模型 ID 持久化到 cookie 中
 * @param model 模型 ID
 */
export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

/**
 * 根据用户的首条消息自动生成对话标题
 * 调用标题模型生成文本，并清理首尾的 #、*、" 等符号与空白。
 * @param message 用户的 UIMessage
 * @param userId 用户 ID
 * @returns 清理后的标题文本
 */
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

/**
 * 删除指定消息之后的所有尾部消息
 * 用于用户编辑某条消息后，丢弃其后的所有回复并重新生成。
 * 通过 Supabase server client（受 RLS 保护）校验消息归属与所属 chat 的所有权。
 * @param id 起始消息 ID
 */
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
