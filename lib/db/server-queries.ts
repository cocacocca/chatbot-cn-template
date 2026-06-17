import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getMessageCountByUserId() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "cct_get_message_count_by_user_id"
  );
  if (error) {
    throw error;
  }
  return data as number;
}
