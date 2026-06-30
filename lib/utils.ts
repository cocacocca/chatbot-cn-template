/** @file 通用工具函数：类名合并、请求封装、UUID 生成、消息转换等 */
import type {
  UIMessage,
  UIMessagePart,
  UITools,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { DBMessage, Document } from '@/lib/db/schema';
import { ChatbotError, type ErrorCode } from './errors';
import type { ChatMessage, CustomUIDataTypes } from './types';

/**
 * 合并 Tailwind 类名：clsx 处理条件类名，twMerge 去重冲突类
 * @param inputs 类名片段
 * @returns 合并后的类名字符串
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * SWR 风格的 fetcher：请求 JSON 并在失败时抛出 ChatbotError
 * @param url 请求地址
 * @returns 解析后的 JSON 数据
 */
export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatbotError(code as ErrorCode, cause);
  }

  return response.json();
};

/**
 * 带统一错误处理的 fetch 封装
 * 网络离线时抛出 offline:chat 错误，其余错误透传
 * @param input 请求信息
 * @param init 请求初始化参数
 * @returns fetch 响应
 */
export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatbotError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    // 离线场景统一映射为 offline:chat
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatbotError('offline:chat');
    }

    throw error;
  }
}

/**
 * 生成符合 UUID v4 规范的随机字符串
 * 典型场景：无 crypto.randomUUID 可用时的兜底实现
 * @returns UUID v4 字符串
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 按索引读取文档列表中对应文档的创建时间
 * 索引越界或列表为空时返回当前时间
 * @param documents 文档列表
 * @param index 文档索引
 * @returns 文档创建时间
 */
export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

/**
 * 清理文本中的特殊标记（如函数调用占位符）
 * @param text 原始文本
 * @returns 清理后的文本
 */
export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

/**
 * 将数据库消息转换为前端可消费的 UIMessage
 * 转换字段：id、role、parts、metadata.createdAt（ISO 格式）
 * @param messages 数据库消息列表
 * @returns UI 消息列表
 */
export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: message.parts as UIMessagePart<CustomUIDataTypes, UITools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

/**
 * 从消息中提取纯文本：过滤出 text 类型 part 并拼接
 * @param message 聊天消息
 * @returns 拼接后的纯文本
 */
export function getTextFromMessage(message: ChatMessage | UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; text: string }).text)
    .join('');
}
