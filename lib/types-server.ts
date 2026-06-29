/**
 * @file 服务端专用类型定义
 * @description 不导入客户端模块（如 ai 包），防止 Turbopack 模块边界错误。
 *   agent 目录和 lib/ai 目录的服务端模块应从此文件导入类型。
 * @module lib/types-server
 */

/** 文档类型（对应 public.document 表，字段名 camelCase） */
export type ServerDocument = {
  id: string;
  createdAt: string;
  userId: string;
  content: string;
  kind: "text" | "code" | "image" | "sheet";
  title: string;
};

/** 建议类型（对应 public.suggestion 表，字段名 camelCase） */
export type ServerSuggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: string;
  userId: string;
  originalText: string;
  suggestedText: string;
  isResolved: boolean;
  createdAt: string;
  description?: string;
};

/** 消息类型（对应 public.message 表，字段名 camelCase） */
export type ServerDBMessage = {
  id: string;
  chatId: string;
  role: string;
  parts: unknown;
  attachments: unknown;
  createdAt: Date;
};

/** Supabase Auth 会话用户（替代 next-auth Session） */
export type ServerSession = {
  user: {
    id: string;
  };
};
