import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title?: string;
  visibility: "public" | "private";
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("chat").upsert(
    {
      id,
      user_id: userId,
      title,
      visibility,
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
  const { error } = await supabase.from("message").insert(rows);
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
    .from("message")
    .delete()
    .eq("chat_id", chatId)
    .gte("created_at", timestamp.toISOString());
  if (error) {
    throw error;
  }
}
