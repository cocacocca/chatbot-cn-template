import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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
