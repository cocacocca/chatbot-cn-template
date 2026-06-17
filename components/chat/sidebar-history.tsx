"use client";

import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import type { Chat } from "@/lib/types";
import { LoaderIcon } from "./icons";
import { ChatItem } from "./sidebar-history-item";

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats
  );
};

// 使用稳定的字符串 key 以兼容 SWR infinite 的 cache.get 调用
const HISTORY_KEY = "chat-history-infinite";

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory | null
): string | null {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) {
    return `${HISTORY_KEY}?page=0`;
  }

  const firstChatFromPage = previousPageData?.chats.at(-1);

  if (!firstChatFromPage) {
    return null;
  }

  return `${HISTORY_KEY}?ending_before=${firstChatFromPage.id}`;
}

async function fetchChatHistoryPage(key: string): Promise<ChatHistory> {
  const supabase = createClient();
  const params = new URLSearchParams(key.split("?")[1] ?? "");
  const endingBefore = params.get("ending_before");

  let query = supabase
    .from("cct_chat")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (endingBefore) {
    const { data: cursorChat } = await supabase
      .from("cct_chat")
      .select("created_at")
      .eq("id", endingBefore)
      .single();

    if (cursorChat) {
      query = query.lt("created_at", cursorChat.created_at);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const hasMore = (data?.length ?? 0) > PAGE_SIZE;
  const chats = (data ?? []).slice(0, PAGE_SIZE).map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
  }));

  return { chats, hasMore };
}

export function SidebarHistory() {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const id = pathname?.startsWith("/chat/") ? pathname.split("/")[2] : null;
  const { user } = useUser();

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(
    user ? getChatHistoryPaginationKey : () => null,
    fetchChatHistoryPage,
    { fallbackData: [], revalidateOnFocus: false }
  );

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory = paginatedChatHistories
    ? paginatedChatHistories.every((page) => page.chats.length === 0)
    : false;

  const handleDelete = async () => {
    const chatToDelete = deleteId;
    const isCurrentChat = pathname === `/chat/${chatToDelete}`;

    setShowDeleteDialog(false);

    if (isCurrentChat) {
      router.replace("/");
    }

    mutate(
      (chatHistories) => {
        if (chatHistories) {
          return chatHistories.map((chatHistory) => ({
            ...chatHistory,
            chats: chatHistory.chats.filter((chat) => chat.id !== chatToDelete),
          }));
        }
        return chatHistories;
      },
      { revalidate: false }
    );

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("cct_chat")
        .delete()
        .eq("id", chatToDelete as string);
      if (error) {
        throw error;
      }
      toast.success("对话已删除");
    } catch (_error) {
      toast.error("删除对话失败");
    }
  };

  if (!user) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-[13px] text-sidebar-foreground/60">
            Login to save and revisit previous chats!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
          History
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="flex flex-col gap-0.5 px-1">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                className="flex h-8 items-center gap-2 rounded-lg px-2"
                key={item}
              >
                <div
                  className="h-3 max-w-(--skeleton-width) flex-1 animate-pulse rounded-md bg-sidebar-foreground/[0.06]"
                  style={
                    {
                      "--skeleton-width": `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
          历史记录
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-[13px] text-sidebar-foreground/60">
            开始对话后，你的记录将显示在这里！
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
          历史记录
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {paginatedChatHistories &&
              (() => {
                const chatsFromHistory = paginatedChatHistories.flatMap(
                  (paginatedChatHistory) => paginatedChatHistory.chats
                );

                const groupedChats = groupChatsByDate(chatsFromHistory);

                return (
                  <div className="flex flex-col gap-4">
                    {groupedChats.today.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          今天
                        </div>
                        {groupedChats.today.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.yesterday.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          Yesterday
                        </div>
                        {groupedChats.yesterday.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.lastWeek.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          最近 7 天
                        </div>
                        {groupedChats.lastWeek.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.lastMonth.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          Last 30 days
                        </div>
                        {groupedChats.lastMonth.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.older.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          Older
                        </div>
                        {groupedChats.older.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
          </SidebarMenu>

          <motion.div
            onViewportEnter={() => {
              if (!isValidating && !hasReachedEnd) {
                setSize((size) => size + 1);
              }
            }}
          />

          {hasReachedEnd ? null : (
            <div className="mt-1 flex flex-row items-center gap-2 px-4 py-2 text-sidebar-foreground/50">
              <div className="animate-spin">
                <LoaderIcon />
              </div>
              <div className="text-[11px]">Loading...</div>
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除吗？</AlertDialogTitle>
            <AlertDialogDescription>删除后将无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
