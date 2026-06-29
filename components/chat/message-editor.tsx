"use client";

/**
 * @file 消息编辑提交逻辑
 * @description 处理用户编辑已发送消息后的提交：删除后续消息、更新当前消息、触发重新生成
 *
 *   设计要点：
 *   - 解耦 UseChatHelpers 类型：仅依赖 setMessages 和 regenerate 的方法签名，
 *     避免引入 @ai-sdk/react 的 UseChatHelpers 类型耦合（便于测试与复用）
 *   - setMessages 签名与 UseChatHelpers.setMessages 一致，支持数组和函数两种形式
 *   - regenerate 签名与 UseChatHelpers.regenerate 一致，返回 Promise<void>
 *
 * @module components/chat/message-editor
 */

import { deleteTrailingMessages } from "@/app/(chat)/actions";
import type { ChatMessage } from "@/lib/types";

/**
 * setMessages 函数签名（与 UseChatHelpers.setMessages 一致）
 * 支持直接传入数组或基于当前消息的更新函数
 */
type SetMessagesFn = (
  messages: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])
) => void;

/**
 * regenerate 函数签名（与 UseChatHelpers.regenerate 一致）
 */
type RegenerateFn = () => Promise<void>;

/**
 * 提交编辑后的消息
 *
 * 流程：
 * 1. 删除该消息之后的所有 trailing messages（服务端）
 * 2. 本地更新该消息的内容为编辑后的文本
 * 3. 触发 regenerate 重新生成 AI 回复
 *
 * @param message - 被编辑的原始消息
 * @param text - 编辑后的新文本
 * @param setMessages - 本地消息更新函数
 * @param regenerate - 重新生成 AI 回复的函数
 */
export async function submitEditedMessage({
  message,
  text,
  setMessages,
  regenerate,
}: {
  message: ChatMessage;
  text: string;
  setMessages: SetMessagesFn;
  regenerate: RegenerateFn;
}) {
  await deleteTrailingMessages({ id: message.id });

  setMessages((messages) => {
    const index = messages.findIndex((m) => m.id === message.id);
    if (index === -1) {
      return messages;
    }

    return [
      ...messages.slice(0, index),
      { ...message, parts: [{ type: "text" as const, text }] },
    ];
  });

  regenerate();
}
