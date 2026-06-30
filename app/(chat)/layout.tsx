/** @file 聊天路由组（chat）的布局组件：加载 Pyodide、预取会话历史、组装侧边栏与聊天外壳 */
import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { SWRProvider } from "@/components/providers/swr-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";
import { ChatShellGate } from "./chat-shell-gate";

/** 预取会话历史的首页条数，用于 SWR fallback，避免客户端 loading 闪烁 */
const PREFETCH_PAGE_SIZE = 50;

/**
 * 聊天布局组件
 * 加载 Pyodide 脚本，并通过 Suspense 覆盖异步内容。
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
      <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
        <ChatLayoutContent>{children}</ChatLayoutContent>
      </Suspense>
    </>
  );
}

// 所有 async 操作集中在此，被 <Suspense> 覆盖，满足 Next.js 16 Cache Components 要求
/**
 * 聊天布局的异步内容部分
 * 预取首页会话历史作为 SWR fallback，读取侧边栏折叠状态，并组装完整布局。
 */
async function ChatLayoutContent({ children }: { children: React.ReactNode }) {
  // 预取首页 chat history 作为 SWR fallback，避免客户端 loading 闪烁
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialChats: Array<{
    id: string;
    title: string | null;
    created_at: string;
  }> = [];

  if (user) {
    const { data } = await supabase
      .from("cct_chat")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(PREFETCH_PAGE_SIZE);
    initialChats = data ?? [];
  }

  // 构造 SWR fallback：仅当有用户且有预取数据时启用
  const fallback =
    user && initialChats.length > 0
      ? {
          "chat-history-infinite?page=0": {
            chats: initialChats.map((c) => ({
              id: c.id,
              title: c.title,
              createdAt: c.created_at,
            })),
            hasMore: initialChats.length >= PREFETCH_PAGE_SIZE,
          },
        }
      : undefined;

  // 读取侧边栏折叠状态 cookie（"true" 表示展开）
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <SWRProvider fallback={fallback}>
      <SidebarProvider defaultOpen={!isCollapsed}>
        <AppSidebar />
        <SidebarInset>
          <Toaster
            position="top-center"
            theme="system"
            toastOptions={{
              className:
                "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
            }}
          />
          <ChatShellGate>{children}</ChatShellGate>
        </SidebarInset>
      </SidebarProvider>
    </SWRProvider>
  );
}
