/** @file 聊天 API 请求体的 Zod schema 定义与类型导出 */
import { z } from "zod";

/** 文本消息片段 schema：限制 1~2000 字符 */
const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

/** 文件消息片段 schema：仅允许 jpeg/png 图片 */
const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

/** 消息片段联合 schema（文本或文件） */
const partSchema = z.union([textPartSchema, filePartSchema]);

/** 用户消息 schema：包含 UUID、role=user 与片段数组 */
const userMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user"]),
  parts: z.array(partSchema),
});

/** 工具审批消息 schema：用于工具调用审批流程，parts 为任意 record */
const toolApprovalMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.record(z.unknown())),
});

/**
 * 聊天 POST 请求体 schema
 * - id：会话 UUID
 * - message：可选的用户消息（普通对话流）
 * - messages：可选的工具审批消息数组（工具审批流）
 * - selectedChatModel：用户选择的模型 ID
 */
export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: userMessageSchema.optional(),
  messages: z.array(toolApprovalMessageSchema).optional(),
  selectedChatModel: z.string(),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
