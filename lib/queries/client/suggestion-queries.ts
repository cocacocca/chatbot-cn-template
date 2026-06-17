import { createClient } from "@/lib/supabase/client";
import type { Suggestion } from "./types";

// 获取文档的建议（按 created_at 升序）
export async function getSuggestions(
  documentId: string,
  documentCreatedAt: string
): Promise<Suggestion[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cct_suggestion")
    .select(
      "id, document_id, document_created_at, user_id, original_text, suggested_text, is_resolved, created_at"
    )
    .eq("document_id", documentId)
    .eq("document_created_at", documentCreatedAt)
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

// 批量保存建议
export async function saveSuggestions(
  suggestions: Array<{
    documentId: string;
    documentCreatedAt: string;
    userId: string;
    originalText: string;
    suggestedText: string;
    isResolved?: boolean;
  }>
): Promise<void> {
  if (suggestions.length === 0) {
    return;
  }

  const supabase = createClient();
  const rows = suggestions.map((s) => ({
    document_id: s.documentId,
    document_created_at: s.documentCreatedAt,
    user_id: s.userId,
    original_text: s.originalText,
    suggested_text: s.suggestedText,
    is_resolved: s.isResolved ?? false,
  }));

  const { error } = await supabase.from("cct_suggestion").insert(rows);
  if (error) {
    throw error;
  }
}
