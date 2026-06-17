"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { ChatShell } from "@/components/chat/shell";
import { ActiveChatProvider } from "@/hooks/use-active-chat";

const enter = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2, ease: "easeOut" },
};

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
