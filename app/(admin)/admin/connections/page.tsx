/** @file Connections 管理页面 - 展示所有 EVE Connections 并提供增删改查入口 */
"use client";

import { AnimatePresence, motion, type Transition } from "framer-motion";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConnectionEditor } from "@/components/admin/connections/connection-editor";
import { ConnectionForm } from "@/components/admin/connections/connection-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ConnectionItem,
  useConnections,
} from "@/hooks/data/use-connections";

/** 弹簧动画过渡配置 */
const spring: Transition = { type: "spring", damping: 25, stiffness: 300 };

/** 上滑淡入动画配置 */
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: spring,
};

/**
 * Connections 管理页面组件
 * 展示 connection 列表，提供新建/编辑/删除操作
 */
export default function ConnectionsPage() {
  const { connections, isLoading, mutate } = useConnections();

  // 对话框状态：使用独立 open 状态避免关闭动画期间内容提前卸载
  const [createOpen, setCreateOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ConnectionItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /** 打开编辑器：记录待编辑数据并显示对话框 */
  function openEditor(conn: ConnectionItem) {
    setEditing(conn);
    setEditorOpen(true);
  }

  /** 请求删除指定 connection（打开确认对话框） */
  function requestDelete(id: string) {
    setDeleteId(id);
    setDeleteOpen(true);
  }

  /** 确认删除 connection：调用 DELETE /api/admin/connections?id=... */
  async function confirmDelete() {
    if (!deleteId) {
      return;
    }

    try {
      const res = await fetch(
        `/api/admin/connections?id=${encodeURIComponent(deleteId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Connection 已删除");
        mutate();
      } else {
        const data = (await res.json().catch(() => ({
          error: "删除失败",
        }))) as { error?: string };
        toast.error(data.error ?? "删除失败");
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleteOpen(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-4xl p-8"
        initial={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 25, stiffness: 280 }}
      >
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Connections 管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              管理 EVE 框架的 Connections，用于连接外部 MCP 或 OpenAPI
              服务。文件位于 agent/connections/ 目录。
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <PlusIcon className="mr-1 size-4" />
            新建 Connection
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton className="h-20 w-full" key={`skeleton-${i}`} />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {connections.length === 0 ? (
              <motion.div
                key="empty"
                {...fadeUp}
                className="rounded-lg border border-dashed border-border/50 p-8 text-center"
              >
                <p className="text-muted-foreground">
                  暂无 Connection，点击上方「新建 Connection」按钮开始添加。
                </p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {connections.map((conn, i) => (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-4"
                    exit={{
                      opacity: 0,
                      scale: 0.96,
                      transition: { duration: 0.15 },
                    }}
                    initial={{ opacity: 0, y: 12 }}
                    key={conn.id}
                    layout
                    transition={{ ...spring, delay: i * 0.04 }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{conn.id}</span>
                        <Badge variant="secondary">
                          {conn.type === "mcp" ? "MCP" : "OpenAPI"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {conn.path}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => openEditor(conn)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <PencilIcon className="size-3.5" />
                        <span className="sr-only">编辑 {conn.id}</span>
                      </Button>
                      <Button
                        onClick={() => requestDelete(conn.id)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <TrashIcon className="size-3.5 text-destructive" />
                        <span className="sr-only">删除 {conn.id}</span>
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        )}
      </motion.div>

      {/* 新建 Connection 对话框 */}
      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建 Connection</DialogTitle>
            <DialogDescription>
              创建新的 EVE Connection，将根据类型生成 TypeScript 代码模板。
            </DialogDescription>
          </DialogHeader>
          <ConnectionForm
            onCancel={() => setCreateOpen(false)}
            onCreated={() => {
              setCreateOpen(false);
              mutate();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* 编辑 Connection 对话框 */}
      <Dialog onOpenChange={setEditorOpen} open={editorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>编辑 Connection</DialogTitle>
            <DialogDescription>
              {editing
                ? `编辑 ${editing.id}（${editing.type === "mcp" ? "MCP" : "OpenAPI"}）`
                : "编辑 Connection 内容"}
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <ConnectionEditor
              connection={editing}
              onCancel={() => setEditorOpen(false)}
              onSaved={() => {
                setEditorOpen(false);
                mutate();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除 Connection「{deleteId}
              」吗？此操作不可撤销，将永久删除对应文件。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteOpen(false)} variant="ghost">
              取消
            </Button>
            <Button onClick={confirmDelete} variant="destructive">
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
