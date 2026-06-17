// 客户端查询层返回类型（camelCase，对应 Supabase 表的 snake_case 字段）

// 聊天摘要（对应 cct_chat 表）
export interface ChatSummary {
  id: string;
  title: string | null;
  createdAt: string;
  userId: string;
}

// 聊天消息（对应 cct_message 表）
export interface ChatMessage {
  id: string;
  chatId: string;
  role: string;
  parts: unknown;
  attachments: unknown | null;
  createdAt: string;
}

// 文档（对应 cct_document 表，id 为文档逻辑主键，created_at 区分版本）
export interface ChatDocument {
  id: string;
  createdAt: string;
  userId: string;
  content: string;
  kind: "text" | "code" | "image" | "sheet";
  title: string;
}

// 建议（对应 cct_suggestion 表）
export interface Suggestion {
  id: string;
  documentId: string;
  documentCreatedAt: string;
  userId: string;
  originalText: string;
  suggestedText: string;
  isResolved: boolean;
  createdAt: string;
}

// 用户资料（对应 cct_user_profile 表，email 来自 auth user）
export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: string;
}
