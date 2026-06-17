import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";

// Supabase Auth 会话用户（替代 next-auth Session）
export type Session = {
  user: {
    id: string;
  };
};

// 文档类型（对应 public.document 表，字段名 camelCase）
export type Document = {
  id: string;
  createdAt: string;
  userId: string;
  content: string;
  kind: "text" | "code" | "image" | "sheet";
  title: string;
};

// 建议类型（对应 public.suggestion 表，字段名 camelCase）
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

// 消息类型（对应 public.message 表，字段名 camelCase）
export type DBMessage = {
  id: string;
  chatId: string;
  role: string;
  parts: unknown;
  attachments: unknown;
  createdAt: Date;
};

// 投票类型（对应 public.vote 表，字段名 camelCase）
export type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

// 聊天历史项类型（对应 public.chat 表，字段名 camelCase）
export type Chat = {
  id: string;
  title: string | null;
  createdAt: string;
};

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

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

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
