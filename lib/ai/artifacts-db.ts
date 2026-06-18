import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Document } from "@/lib/types";

// 查询单个文档的最新版本（通过 cct_document_latest view）
export async function getDocumentById(id: string): Promise<Document | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cct_document_latest")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    throw error;
  }
  if (!data) {
    return null;
  }
  return {
    id: data.id ?? "",
    createdAt: data.created_at ?? "",
    userId: data.user_id ?? "",
    content: data.content ?? "",
    // view 字段允许 null，用默认值兜底并断言为联合类型
    kind: (data.kind ?? "text") as "text" | "code" | "image" | "sheet",
    title: data.title ?? "",
  };
}

export async function saveDocument({
  id,
  userId,
  content,
  kind,
  title,
}: {
  id: string;
  userId: string;
  content: string;
  kind: "text" | "code" | "image" | "sheet";
  title: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("cct_document").insert({
    id,
    user_id: userId,
    content,
    kind,
    title,
  });
  if (error) {
    throw error;
  }
}

export async function updateDocumentContent(
  documentId: string,
  content: string
) {
  const supabase = createAdminClient();
  // 复合主键表：插入新版本实现更新
  const { data: latest, error: fetchError } = await supabase
    .from("cct_document_latest")
    .select("id, kind, title, user_id")
    .eq("id", documentId)
    .single();

  if (fetchError) {
    throw fetchError;
  }
  if (!latest) {
    throw new Error("Document not found");
  }

  const { error } = await supabase.from("cct_document").insert({
    id: documentId,
    user_id: latest.user_id ?? "",
    content,
    // view 字段允许 null，用默认值兜底并断言为联合类型
    kind: (latest.kind ?? "text") as "text" | "code" | "image" | "sheet",
    title: latest.title,
  });
  if (error) {
    throw error;
  }
}

export async function saveSuggestions({
  documentId,
  documentCreatedAt,
  userId,
  suggestions,
}: {
  documentId: string;
  documentCreatedAt: string;
  userId: string;
  suggestions: Array<{ originalText: string; suggestedText: string }>;
}) {
  const supabase = createAdminClient();
  const rows = suggestions.map((s) => ({
    document_id: documentId,
    document_created_at: documentCreatedAt,
    user_id: userId,
    original_text: s.originalText,
    suggested_text: s.suggestedText,
  }));
  const { error } = await supabase.from("cct_suggestion").insert(rows);
  if (error) {
    throw error;
  }
}
