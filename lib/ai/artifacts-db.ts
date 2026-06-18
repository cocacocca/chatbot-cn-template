/** @file 文档（Artifact）数据库访问层，提供文档查询、保存、更新及建议（suggestion）持久化能力。 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Document } from "@/lib/types";

/**
 * 根据 id 查询单个文档的最新版本。
 * 通过 `cct_document_latest` 视图读取，该视图返回每个文档 id 的最新一行。
 *
 * @param id 文档唯一标识
 * @returns 文档对象；不存在时返回 null
 */
// 查询单个文档的最新版本（通过 cct_document_latest view）
export async function getDocumentById(id: string): Promise<Document | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cct_document_latest")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    // PGRST116 表示未命中行，视为文档不存在
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

/**
 * 保存一篇新文档（写入 `cct_document` 表，作为新版本）。
 *
 * @param params.id 文档唯一标识
 * @param params.userId 所属用户 id
 * @param params.content 文档内容
 * @param params.kind 文档类型（text/code/image/sheet）
 * @param params.title 文档标题
 */
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

/**
 * 更新文档内容：先读取最新版本的元信息，再以新内容插入一行（复合主键表通过插入新版本实现更新）。
 *
 * @param documentId 文档唯一标识
 * @param content 新的文档内容
 */
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

/**
 * 批量保存文档的写作建议（写入 `cct_suggestion` 表）。
 *
 * @param params.documentId 关联文档 id
 * @param params.documentCreatedAt 关联文档的创建时间（用于复合主键）
 * @param params.userId 所属用户 id
 * @param params.suggestions 建议列表，每项包含原文与建议文本
 */
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
  // 将 camelCase 字段映射为数据库 snake_case 列名
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
