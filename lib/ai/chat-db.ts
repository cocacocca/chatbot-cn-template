/** @file 聊天会话数据库访问层，提供会话保存、消息批量写入及按时间戳清理消息的能力。 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 保存或更新一个聊天会话（写入 `cct_chat` 表）。
 * 使用 upsert + onConflict(id) 策略：相同 id 时更新，否则插入。
 *
 * @param params.id 会话唯一标识
 * @param params.userId 所属用户 id
 * @param params.title 会话标题（可选）
 */
export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title?: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("cct_chat").upsert(
    {
      id,
      user_id: userId,
      title,
    },
    { onConflict: "id" }
  );
  if (error) {
    throw error;
  }
}

/**
 * 批量保存聊天消息（写入 `cct_message` 表）。
 * 将入参中的 `chatId` / `createdAt` 映射为数据库列 `chat_id` / `created_at`。
 *
 * @param messages 消息数组，每项包含 id、chatId、role、parts、attachments 及可选 createdAt
 */
export async function saveMessages(
  messages: Array<{
    id: string;
    chatId: string;
    role: string;
    parts: any;
    attachments: any;
    createdAt?: Date;
  }>
) {
  const supabase = createAdminClient();
  // 拆分 chatId 与 createdAt，转换为数据库列名后合并回 rest 字段
  const rows = messages.map(({ chatId, createdAt, ...rest }) => ({
    ...rest,
    chat_id: chatId,
    ...(createdAt && { created_at: createdAt.toISOString() }),
  }));
  const { error } = await supabase.from("cct_message").insert(rows);
  if (error) {
    throw error;
  }
}

/**
 * 删除指定会话中时间戳大于等于给定时间点的所有消息。
 * 用于在用户重新生成某条消息时，清理其后继消息。
 *
 * @param chatId 会话唯一标识
 * @param timestamp 起始时间戳（含），早于或等于该时间的消息保留
 */
export async function deleteMessagesByChatIdAfterTimestamp(
  chatId: string,
  timestamp: Date
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("cct_message")
    .delete()
    .eq("chat_id", chatId)
    .gte("created_at", timestamp.toISOString());
  if (error) {
    throw error;
  }
}
