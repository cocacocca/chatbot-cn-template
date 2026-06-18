"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

// 处理 URL ?query= 参数自动发送消息
export function useQueryAutoSend(
  chatId: string,
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"],
  status: UseChatHelpers<ChatMessage>["status"]
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasSentRef = useRef(false);

  useEffect(() => {
    const query = searchParams.get("query");
    if (query && !hasSentRef.current && status === "ready") {
      hasSentRef.current = true;
      // 发送后清除 URL 中的 query 参数
      router.replace(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });
    }
  }, [searchParams, sendMessage, chatId, status, router]);
}
