"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

// 从 URL pathname 解析 chatId
function extractChatId(pathname: string): string | null {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

// 从 URL 解析 chatId，或在新建聊天时生成 UUID
export function useChatIdFromUrl(): {
  chatId: string;
  isNewChat: boolean;
} {
  const pathname = usePathname();
  const chatIdFromUrl = extractChatId(pathname);
  const isNewChat = !chatIdFromUrl;

  // 用 useState 缓存新聊天的 UUID，避免重渲染时重新生成
  const [newChatId, setNewChatId] = useState<string>(() => crypto.randomUUID());
  const [prevPathname, setPrevPathname] = useState(pathname);

  // pathname 变化时（从一个新聊天导航到另一个新聊天），重新生成 UUID
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (isNewChat) {
      setNewChatId(crypto.randomUUID());
    }
  }

  const chatId = chatIdFromUrl ?? newChatId;

  return { chatId, isNewChat };
}
