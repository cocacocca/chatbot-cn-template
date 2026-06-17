// 兼容性类型导出：旧代码从 @/lib/db/schema 导入类型，
// 实际类型定义已迁移至 @/lib/types.ts（camelCase）。
// 此文件作为 re-export 桥接，避免大量 import 路径修改。

export type { DBMessage, Document, Suggestion } from "@/lib/types";

// Chat 类型（对应 public.chat 表，字段名 camelCase）
export type Chat = {
  id: string;
  title: string | null;
  visibility: "public" | "private";
  createdAt: string;
};

// Vote 类型（对应 public.vote 表，字段名 camelCase）
export type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};
