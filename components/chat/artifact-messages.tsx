/** @file Artifact 视图中的消息列表组件，显示会话消息并处理滚动与加载状态 */
import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { useScrollToBottom } from "@/hooks/chat/use-scroll-to-bottom";
import type { ChatMessage } from "@/lib/types";
import type { UIArtifact } from "./artifact";
import { PreviewMessage, ThinkingMessage } from "./message";

/** ArtifactMessages 组件属性，从 ActiveChatContextValue 中提取相关字段 */
type ArtifactMessagesProps = {
  addToolApprovalResponse: (params: {
    messageId: string;
    approvalId: string;
    approved: boolean;
  }) => Promise<void>;
  chatId: string;
  status: "ready" | "submitted" | "in_progress" | "error";
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  regenerate: () => Promise<void>;
  artifactStatus: UIArtifact["status"];
};

function PureArtifactMessages({
  addToolApprovalResponse,
  chatId,
  status,
  messages,
  setMessages,
  regenerate,
}: ArtifactMessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
  } = useScrollToBottom();

  return (
    <div
      className="flex h-full flex-col items-center gap-4 overflow-y-scroll px-4 pt-20"
      ref={messagesContainerRef}
    >
      {messages.map((message, index) => (
        <PreviewMessage
          addToolApprovalResponse={addToolApprovalResponse}
          chatId={chatId}
          isLoading={status === "in_progress" && index === messages.length - 1}
          key={message.id}
          message={message}
          regenerate={regenerate}
          requiresScrollPadding={
            messages.length > 0 && index === messages.length - 1
          }
          setMessages={setMessages}
        />
      ))}

      <AnimatePresence mode="wait">
        {status === "submitted" &&
          !messages.some((msg) =>
            msg.parts?.some(
              (part) => "state" in part && part.state === "approval-responded"
            )
          ) && <ThinkingMessage key="thinking" />}
      </AnimatePresence>

      <motion.div
        className="min-h-[24px] min-w-[24px] shrink-0"
        onViewportEnter={onViewportEnter}
        onViewportLeave={onViewportLeave}
        ref={messagesEndRef}
      />
    </div>
  );
}

function areEqual(
  prevProps: ArtifactMessagesProps,
  nextProps: ArtifactMessagesProps
) {
  if (
    prevProps.artifactStatus === "streaming" &&
    nextProps.artifactStatus === "streaming"
  ) {
    return true;
  }

  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.status && nextProps.status) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }

  return true;
}

export const ArtifactMessages = memo(PureArtifactMessages, areEqual);
