/** @file 全局类型定义：会话、文档、建议、消息、聊天及 UI 数据类型 */
import type { UIMessage } from "ai";
import { z } from "zod";

/** Supabase Auth 会话用户（替代 next-auth Session） */
export type Session = {
  user: {
    id: string;
  };
};

/** 文档类型（对应 public.document 表，字段名 camelCase） */
export type Document = {
  id: string;
  createdAt: string;
  userId: string;
  content: string;
  kind: "text" | "code" | "image" | "sheet";
  title: string;
};

/** 建议类型（对应 public.suggestion 表，字段名 camelCase） */
export type Suggestion = {
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
export type DBMessage = {
  id: string;
  chatId: string;
  role: string;
  parts: unknown;
  attachments: unknown;
  createdAt: Date;
};

/** 聊天历史项类型（对应 public.chat 表，字段名 camelCase） */
export type Chat = {
  id: string;
  title: string | null;
  createdAt: string;
};

/** 消息元数据 schema：仅记录创建时间 */
export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

/** 消息元数据类型 */
export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

/**
 * 自定义 UI 数据类型：流式增量、建议、消息控制信号等
 * 用于 UIMessage 的 data parts 通道
 */
export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: "text" | "code" | "image" | "sheet";
  clear: null;
  finish: null;
  "chat-title": string;
};

/** 应用统一聊天消息类型：携带元数据（AI SDK 7 beta 简化版本） */
export type ChatMessage = UIMessage<MessageMetadata>;

/** 消息附件类型 */
export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
