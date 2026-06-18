"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { getChatHistoryPaginationKey } from "@/components/chat/sidebar-history";
import { toast } from "@/components/chat/toast";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { useChatIdFromUrl } from "./use-chat-id-from-url";
import { useChatMessages } from "./use-chat-messages";
import { useChatModel } from "./use-chat-model";
import { useQueryAutoSend } from "./use-query-auto-send";

type ActiveChatContextValue = {
  chatId: string;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  status: UseChatHelpers<ChatMessage>["status"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  isLoading: boolean;
  currentModelId: string;
  setCurrentModelId: (id: string) => void;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const { setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();

  // 从 URL 解析 chatId（新聊天时生成 UUID）
  const { chatId, isNewChat } = useChatIdFromUrl();

  // SWR 拉取已有聊天的消息
  const { messages: loadedMessages, isLoading } = useChatMessages(
    isNewChat ? null : chatId
  );

  // 管理 chat-model cookie
  const { currentModelId, setCurrentModelId } = useChatModel();

  // 用 ref 跟踪当前模型 id，供 transport 闭包读取最新值
  const currentModelIdRef = useRef(currentModelId);
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const [input, setInput] = useState("");

  const initialMessages: ChatMessage[] = isNewChat
    ? []
    : (loadedMessages ?? []);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    generateId: generateUUID,
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      return (
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false
      );
    },
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat`,
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const lastMessage = request.messages.at(-1);
        const isToolApprovalContinuation =
          lastMessage?.role !== "user" ||
          request.messages.some((msg) =>
            msg.parts?.some((part) => {
              const state = (part as { state?: string }).state;
              return (
                state === "approval-responded" || state === "output-denied"
              );
            })
          );

        return {
          body: {
            id: request.id,
            ...(isToolApprovalContinuation
              ? { messages: request.messages }
              : { message: lastMessage }),
            selectedChatModel: currentModelIdRef.current,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatbotError) {
        toast({ type: "error", description: error.message });
      } else {
        toast({
          type: "error",
          description: error.message || "发生错误，请稍后重试",
        });
      }
    },
  });

  // 同步已加载的消息到 useChat（避免重复同步）
  const loadedChatIds = useRef(new Set<string>());
  useEffect(() => {
    if (loadedChatIds.current.has(chatId)) {
      return;
    }
    if (loadedMessages) {
      loadedChatIds.current.add(chatId);
      setMessages(loadedMessages);
    }
  }, [chatId, loadedMessages, setMessages]);

  // 切换到新聊天时清空消息
  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      if (isNewChat) {
        setMessages([]);
      }
    }
  }, [chatId, isNewChat, setMessages]);

  // 处理 URL ?query= 参数自动发送
  useQueryAutoSend(chatId, sendMessage, status);

  const value = useMemo<ActiveChatContextValue>(
    () => ({
      chatId,
      messages,
      setMessages,
      sendMessage,
      status,
      stop,
      regenerate,
      addToolApprovalResponse,
      input,
      setInput,
      isLoading: !isNewChat && isLoading,
      currentModelId,
      setCurrentModelId,
    }),
    [
      chatId,
      messages,
      setMessages,
      sendMessage,
      status,
      stop,
      regenerate,
      addToolApprovalResponse,
      input,
      isNewChat,
      isLoading,
      currentModelId,
      setCurrentModelId,
    ]
  );

  return (
    <ActiveChatContext.Provider value={value}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat() {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return context;
}
