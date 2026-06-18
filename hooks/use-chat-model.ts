"use client";

import { useCallback, useState } from "react";

const CHAT_MODEL_COOKIE = "chat-model";
const MAX_AGE = 60 * 60 * 24 * 365;

// 从 cookie 读取 chat-model 值
function readModelFromCookie(): string {
  if (typeof document === "undefined") {
    return "";
  }
  const cookieModel = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CHAT_MODEL_COOKIE}=`))
    ?.split("=")[1];
  return cookieModel ? decodeURIComponent(cookieModel) : "";
}

// 将 chat-model 写入 cookie
function writeModelToCookie(value: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: 客户端写入 cookie
  document.cookie = `${CHAT_MODEL_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE}`;
}

// 管理 chat-model cookie 的读写
export function useChatModel() {
  // 初始化时从 cookie 读取当前模型
  const [currentModelId, setCurrentModelIdState] = useState<string>(() =>
    readModelFromCookie()
  );

  // 用 useCallback 保持引用稳定，避免消费者不必要的重渲染
  const setCurrentModelId = useCallback((id: string) => {
    setCurrentModelIdState(id);
    writeModelToCookie(id);
  }, []);

  return {
    currentModelId,
    setCurrentModelId,
  };
}
