/** @file 当前活跃会话上下文，使用 EVE Agent 统一管理聊天状态、消息收发与模型切换 */
"use client";

import { useEveAgent } from "eve/react";
import { usePathname } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import type { UIArtifact } from "@/components/chat/artifact";
import { getChatHistoryPaginationKey } from "@/components/chat/sidebar-history";
import { toast } from "@/components/chat/toast";
import { initialArtifactData } from "@/hooks/data/use-artifact";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

/** 活跃会话上下文值，对外暴露的会话状态与操作集合 */
type ActiveChatContextValue = {
  chatId: string;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  sendMessage: (message: {
    role: "user";
    parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; url: string; name?: string; mediaType: string }
    >;
  }) => Promise<void>;
  status: "ready" | "submitted" | "in_progress" | "error";
  stop: () => void;
  regenerate: () => Promise<void>;
  addToolApprovalResponse: (params: {
    messageId: string;
    approvalId: string;
    approved: boolean;
  }) => Promise<void>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  isLoading: boolean;
  currentModelId: string;
  setCurrentModelId: (id: string) => void;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

/**
 * 从路由路径中解析会话 ID
 *
 * @param pathname 当前路由路径
 * @returns 命中 `/chat/:id` 时返回会话 ID，否则返回 null（表示新会话）
 */
function extractChatId(pathname: string): string | null {
  const match = pathname.match(/\/chat\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * 活跃会话 Provider
 *
 * 使用 EVE Agent 管理会话状态，封装 useEveAgent，
 * 统一处理消息加载、模型切换、工具审批续传、URL query 自动发送等逻辑。
 *
 * @param children 子组件
 */
export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mutate } = useSWRConfig();

  const chatIdFromUrl = extractChatId(pathname);
  const isNewChat = !chatIdFromUrl;
  const newChatIdRef = useRef(generateUUID());
  const prevPathnameRef = useRef(pathname);

  // 路由变化时为新会话生成新的临时 ID
  if (isNewChat && prevPathnameRef.current !== pathname) {
    newChatIdRef.current = generateUUID();
  }
  prevPathnameRef.current = pathname;

  const chatId = chatIdFromUrl ?? newChatIdRef.current;

  const [currentModelId, setCurrentModelId] = useState<string>("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // 使用 EVE Agent
  const agent = useEveAgent({
    onEvent: (event) => {
      // 处理数据流事件（如 artifact 更新）
      // EVE 事件类型不包含 "data-chat-title"，需要通过其他方式处理标题更新
      // 暂时移除对 "data-chat-title" 的检查，标题更新通过 onFinish 回调处理
      if (event.type === "turn.completed") {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
      }
    },
    onError: (error) => {
      toast({
        type: "error",
        description: error.message || "发生错误，请稍后重试",
      });
    },
    onFinish: () => {
      // 会话结束后刷新侧边栏历史列表
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
  });

  // 同步 EVE messages 到本地 state
  useEffect(() => {
    setMessages(agent.data.messages as ChatMessage[]);
  }, [agent.data.messages]);

  // 通过 SWR 共享 artifact 状态（与 useArtifact hook 使用同一 key "artifact"）
  const { mutate: setArtifact } = useSWR<UIArtifact>("artifact", null, {
    fallbackData: initialArtifactData,
  });

  // 记录已处理的 tool call id，避免重复更新 artifact 状态
  const processedArtifactToolCallsRef = useRef<Set<string>>(new Set());

  // 监听消息变化：解析 artifact 相关 tool result，自动更新 artifact 状态并展示
  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    // 仅处理最新一条助手消息的 tool result
    const latestMessage = messages.at(-1);
    if (latestMessage?.role !== "assistant") {
      return;
    }

    // 仅这三种 tool 会产出 artifact 内容，需触发 artifact 视图展示
    const artifactToolTypes = new Set([
      "tool-create-document",
      "tool-edit-document",
      "tool-update-document",
    ]);

    for (const part of latestMessage.parts ?? []) {
      const partType = (part as { type: string }).type;
      if (!artifactToolTypes.has(partType)) {
        continue;
      }

      const toolCallId = (part as { toolCallId?: string }).toolCallId;
      const partState = (part as { state?: string }).state;
      // 仅在输出就绪时处理，且去重避免重复触发
      if (!toolCallId || partState !== "output-available") {
        continue;
      }
      if (processedArtifactToolCallsRef.current.has(toolCallId)) {
        continue;
      }

      const output = (part as { output?: Record<string, unknown> }).output;
      if (!output || typeof output.id !== "string") {
        continue;
      }

      processedArtifactToolCallsRef.current.add(toolCallId);

      // 将 tool 返回的结构化数据写入 artifact 状态，触发右侧 artifact 面板展示
      setArtifact({
        documentId: output.id,
        title: typeof output.title === "string" ? output.title : "",
        kind: (output.kind as UIArtifact["kind"]) ?? "text",
        content: typeof output.content === "string" ? output.content : "",
        isVisible: true,
        status: "idle",
        boundingBox: { top: 0, left: 0, width: 0, height: 0 },
      });
    }
  }, [messages, setArtifact]);

  // 映射 EVE status 到 UI status
  const status = useMemo(() => {
    switch (agent.status) {
      case "ready":
        return "ready" as const;
      case "submitted":
      case "streaming":
        return "in_progress" as const;
      case "error":
        return "error" as const;
      default:
        return "ready" as const;
    }
  }, [agent.status]);

  // 发送消息
  const sendMessage = useCallback(
    async (message: {
      role: "user";
      parts: Array<
        | { type: "text"; text: string }
        | { type: "file"; url: string; name?: string; mediaType: string }
      >;
    }) => {
      // 提取文本内容
      const textParts = message.parts.filter((p) => p.type === "text");
      const text = textParts.map((p) => p.text).join("");

      // 提取文件附件
      const fileParts = message.parts.filter((p) => p.type === "file");

      // 发送消息（目前 EVE agent.send 只支持文本，文件附件需要单独处理）
      // TODO: 当 EVE 支持文件附件时，更新此实现
      if (text) {
        await agent.send({ message: text });
      }

      // 如果有文件附件但没有文本，发送一个提示
      if (fileParts.length > 0 && !text) {
        await agent.send({ message: "请分析这些文件..." });
      }
    },
    [agent]
  );

  // 重新生成：重发最后一条用户消息
  const regenerate = useCallback(async () => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMessage) {
      const text = lastUserMessage.parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      if (text) {
        await agent.send({ message: text });
      }
    }
  }, [messages, agent]);

  // 工具审批响应
  const addToolApprovalResponse = useCallback(
    async (params: {
      messageId: string;
      approvalId: string;
      approved: boolean;
    }) => {
      // EVE 的 HITL 响应通过 inputResponses 发送
      await agent.send({
        inputResponses: [
          {
            requestId: params.approvalId,
            optionId: params.approved ? "approve" : "deny",
          },
        ],
      });
    },
    [agent]
  );

  // 会话切换时重置状态
  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      // 会话切换时清空已处理 tool call 记录，避免新会话漏处理
      processedArtifactToolCallsRef.current.clear();
      if (isNewChat) {
        setMessages([]);
        agent.reset();
      }
    }
  }, [chatId, isNewChat, agent]);

  // 从 cookie 中恢复用户上次选择的模型
  useEffect(() => {
    if (!isNewChat) {
      const cookieModel = document.cookie
        .split("; ")
        .find((row) => row.startsWith("chat-model="))
        ?.split("=")[1];
      if (cookieModel) {
        setCurrentModelId(decodeURIComponent(cookieModel));
      }
    }
  }, [isNewChat]);

  // 处理 URL 中携带的 query 参数：自动发送一次用户消息
  const hasAppendedQueryRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    if (query && !hasAppendedQueryRef.current) {
      hasAppendedQueryRef.current = true;
      window.history.replaceState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });
    }
  }, [chatId, sendMessage]);

  const value = useMemo<ActiveChatContextValue>(
    () => ({
      chatId,
      messages,
      setMessages,
      sendMessage,
      status,
      stop: agent.stop,
      regenerate,
      addToolApprovalResponse,
      input,
      setInput,
      isLoading: status === "in_progress",
      currentModelId,
      setCurrentModelId,
    }),
    [
      chatId,
      messages,
      sendMessage,
      status,
      agent.stop,
      regenerate,
      addToolApprovalResponse,
      input,
      currentModelId,
    ]
  );

  return (
    <ActiveChatContext.Provider value={value}>
      {children}
    </ActiveChatContext.Provider>
  );
}

/**
 * 活跃会话 Hook
 *
 * 必须在 `ActiveChatProvider` 内部使用，获取当前会话的状态与操作方法。
 *
 * @returns 活跃会话上下文值
 */
export function useActiveChat() {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return context;
}
