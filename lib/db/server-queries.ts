import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function voteMessage({
  chatId,
  messageId,
  isUpvoted,
}: {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
}) {
  const supabase = createAdminClient();
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

export async function getMessageCountByUserId() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_message_count_by_user_id");
  if (error) {
    throw error;
  }
  return data as number;
}
