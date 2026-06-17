import "server-only";
import { createAdminClient } from '@/lib/supabase/admin';

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title?: string;
  visibility: 'public' | 'private';
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('chat').upsert(
    {
      id,
      user_id: userId,
      title,
      visibility,
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

export async function saveMessages(messages: Array<{
  id: string;
  chat_id: string;
  role: string;
  parts: any;
  attachments: any;
}>) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('message').insert(messages);
  if (error) throw error;
}

export async function deleteMessagesByChatIdAfterTimestamp(
  chatId: string,
  timestamp: Date
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('message')
    .delete()
    .eq('chat_id', chatId)
    .gte('created_at', timestamp.toISOString());
  if (error) throw error;
}
