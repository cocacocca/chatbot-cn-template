/** @file 聊天外壳守卫组件：根据路径在设置页与聊天外壳之间切换 */
"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { ChatShell } from "@/components/chat/shell";
import { ActiveChatProvider } from "@/hooks/chat/use-active-chat";

/** 进入动画配置：淡入 */
const enter = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2, ease: "easeOut" },
};

/**
 * 聊天外壳守卫组件
 * 根据当前路径末尾是否为 /settings 决定渲染：
 * - 设置页：直接渲染 children（设置页面内容）
 * - 聊天页：渲染 ChatShell（含 ActiveChatProvider 与 Suspense）
 */
export function ChatShellGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSettings = pathname.endsWith("/settings");

  return (
    <div className="relative flex-1 overflow-hidden">
      {isSettings ? (
        <motion.div
          className="absolute inset-0 overflow-y-auto"
          key="settings"
          {...enter}
        >
          {children}
        </motion.div>
      ) : (
        <motion.div className="absolute inset-0" key="chat" {...enter}>
          <Suspense fallback={<div className="flex h-full" />}>
            <ActiveChatProvider>
              <ChatShell />
            </ActiveChatProvider>
          </Suspense>
        </motion.div>
      )}
    </div>
  );
}
