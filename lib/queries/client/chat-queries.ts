import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, ChatSummary } from "./types";

// 获取用户的历史 chat 列表（按 created_at 降序）
export async function getChats(
  limit?: number,
  offset?: number
): Promise<ChatSummary[]> {
  const supabase = createClient();
  let query = supabase
    .from("cct_chat")
    .select("id, title, created_at, user_id")
    .order("created_at", { ascending: false });

  if (limit !== undefined) {
    query = query.limit(limit);
  }

  if (offset !== undefined && offset > 0) {
    query = query.range(offset, offset + (limit ?? 0) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    userId: row.user_id,
  }));
}

// 获取单个 chat
export async function getChatById(chatId: string): Promise<ChatSummary | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cct_chat")
    .select("id, title, created_at, user_id")
    .eq("id", chatId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // 未找到记录
      return null;
    }
    throw error;
  }

  return {
    id: data.id,
    title: data.title,
    createdAt: data.created_at,
    userId: data.user_id,
  };
}

// 删除单个 chat
export async function deleteChat(chatId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("cct_chat").delete().eq("id", chatId);
  if (error) {
    throw error;
  }
}

// 删除用户所有 chat
export async function deleteAllChats(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("cct_chat").delete().neq("id", "");
  if (error) {
    throw error;
  }
}

// 获取 chat 的所有消息（按 created_at 升序）
export async function getMessagesByChatId(
  chatId: string
): Promise<ChatMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cct_message")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    chatId: m.chat_id,
    role: m.role,
    parts: m.parts,
    attachments: m.attachments,
    createdAt: m.created_at,
  }));
}

// 更新 chat 标题
export async function updateChatTitle(
  chatId: string,
  title: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cct_chat")
    .update({ title })
    .eq("id", chatId);
  if (error) {
    throw error;
  }
}
