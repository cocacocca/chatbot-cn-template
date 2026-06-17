"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Document } from "@/lib/types";

export function useDocuments(documentId: string) {
  const supabase = createClient();

  return useSWR<Document[]>(["documents", documentId], async () => {
    const { data, error } = await supabase
      .from("cct_document")
      .select("id, created_at, content, kind, title")
      .eq("id", documentId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      userId: "",
      content: row.content ?? "",
      kind: row.kind,
      title: row.title ?? "",
    }));
  });
}

export function useLatestDocument(documentId: string) {
  const supabase = createClient();

  return useSWR<Document>(["document-latest", documentId], async () => {
    const { data, error } = await supabase
      .from("cct_document_latest")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      createdAt: data.created_at,
      userId: data.user_id,
      content: data.content ?? "",
      kind: data.kind,
      title: data.title ?? "",
    };
  });
}
