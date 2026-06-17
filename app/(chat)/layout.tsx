import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { SWRProvider } from "@/components/providers/swr-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";
import { ChatShellGate } from "./chat-shell-gate";

const PREFETCH_PAGE_SIZE = 50;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
      <DataStreamProvider>
        <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
          <SWRProvider fallback={fallback}>
            <SidebarShell>{children}</SidebarShell>
          </SWRProvider>
        </Suspense>
      </DataStreamProvider>
    </>
  );
}

async function SidebarShell({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
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
  );
}
