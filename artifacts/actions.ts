"use server";

import { createClient } from "@/lib/supabase/server";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cct_suggestion")
    .select(
      "id, document_id, document_created_at, user_id, original_text, suggested_text, is_resolved, created_at"
    )
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    documentCreatedAt: row.document_created_at,
    userId: row.user_id,
    originalText: row.original_text ?? "",
    suggestedText: row.suggested_text ?? "",
    isResolved: row.is_resolved,
    createdAt: row.created_at,
  }));
}
