"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Suggestion } from "@/lib/types";

export function useSuggestions(documentId: string, documentCreatedAt: string) {
  const supabase = createClient();

  return useSWR<Suggestion[]>(
    ["suggestions", documentId, documentCreatedAt],
    async () => {
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
  );
}
