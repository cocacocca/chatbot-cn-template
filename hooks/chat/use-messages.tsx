/** @file 消息列表 Hook，封装滚动控制与已发送状态 */
import type { UseChatHelpers } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { useScrollToBottom } from "./use-scroll-to-bottom";

/**
 * 消息列表 Hook
 *
 * 在滚动到底部能力之上叠加「是否已发送过消息」状态，
 * 用于控制空会话提示、欢迎语等 UI 表现。
 *
 * @param status 当前会话状态
 * @returns 容器与底部锚点 ref、是否在底部、滚动方法、视口回调、已发送标记与重置方法
 */
export function useMessages({
  status,
}: {
  status: UseChatHelpers<ChatMessage>["status"];
}) {
  const {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    reset,
  } = useScrollToBottom();

  const [hasSentMessage, setHasSentMessage] = useState(false);

  // 消息进入 submitted 状态时标记为已发送
  useEffect(() => {
    if (status === "submitted") {
      setHasSentMessage(true);
    }
  }, [status]);

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
    reset,
  };
}
