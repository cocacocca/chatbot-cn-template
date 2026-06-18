import { createClient } from "@/lib/supabase/client";
import type { ChatDocument } from "./types";

// 获取文档的所有版本（按 created_at 升序）
export async function getDocumentsByDocumentId(
  documentId: string
): Promise<ChatDocument[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cct_document")
    .select("id, created_at, content, kind, title, user_id")
    .eq("id", documentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    userId: row.user_id,
    content: row.content ?? "",
    kind: row.kind,
    title: row.title ?? "",
  }));
}

// 获取文档最新版本（查 cct_document_latest view）
export async function getLatestDocument(
  documentId: string
): Promise<ChatDocument> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cct_document_latest")
    .select("*")
    .eq("id", documentId)
    .single();

  if (error) {
    throw error;
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

// 创建新文档版本
export async function saveDocument(data: {
  id: string;
  userId: string;
  content: string;
  kind: "text" | "code" | "image" | "sheet";
  title: string;
  createdAt?: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("cct_document").insert({
    id: data.id,
    created_at: data.createdAt ?? new Date().toISOString(),
    user_id: data.userId,
    content: data.content,
    kind: data.kind,
    title: data.title,
  });

  if (error) {
    throw error;
  }
}

// 删除指定版本（删除 id 匹配且 created_at <= createdAt 的所有版本）
export async function deleteDocument(
  documentId: string,
  createdAt: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cct_document")
    .delete()
    .eq("id", documentId)
    .lte("created_at", createdAt);
  if (error) {
    throw error;
  }
}
