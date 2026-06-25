/** @file Skills 管理页面 - 展示所有 agent skills 并提供增删改查入口 */
"use client";

import { AnimatePresence, motion, type Transition } from "framer-motion";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SkillEditor } from "@/components/admin/skills/skill-editor";
import { SkillForm } from "@/components/admin/skills/skill-form";
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
import { type SkillItem, useSkills } from "@/hooks/data/use-skills";

/** 弹簧动画过渡配置 */
const spring: Transition = { type: "spring", damping: 25, stiffness: 300 };

/** 上滑淡入动画配置 */
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: spring,
};

/** 待删除项的标识（id + type），删除接口需两个参数共同定位资源 */
type DeleteTarget = {
  id: string;
  type: SkillItem["type"];
};

/**
 * Skills 管理页面组件
 * 展示 skill 列表，提供新建/编辑/删除操作
 */
export default function SkillsPage() {
  const { skills, isLoading, mutate } = useSkills();

  // 对话框状态：使用独立 open 状态避免关闭动画期间内容提前卸载
  const [createOpen, setCreateOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SkillItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  /** 打开编辑器：记录待编辑数据并显示对话框 */
  function openEditor(skill: SkillItem) {
    setEditing(skill);
    setEditorOpen(true);
  }

  /** 请求删除指定 skill（打开确认对话框） */
  function requestDelete(target: DeleteTarget) {
    setDeleteTarget(target);
    setDeleteOpen(true);
  }

  /** 确认删除 skill：调用 DELETE /api/admin/skills?id=...&type=... */
  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    const { id, type } = deleteTarget;
    const params = new URLSearchParams({ id, type });

    try {
      const res = await fetch(`/api/admin/skills?${params.toString()}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Skill 已删除");
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
            <h1 className="text-2xl font-semibold">Skills 管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              管理 Agent Skills，文件位于 agent/skills/ 目录。支持
              Flat（单文件）与 Packaged（目录）两种形态。
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <PlusIcon className="mr-1 size-4" />
            新建 Skill
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
            {skills.length === 0 ? (
              <motion.div
                key="empty"
                {...fadeUp}
                className="rounded-lg border border-dashed border-border/50 p-8 text-center"
              >
                <p className="text-muted-foreground">
                  暂无 Skill，点击上方「新建 Skill」按钮开始添加。
                </p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {skills.map((skill, i) => (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-4"
                    exit={{
                      opacity: 0,
                      scale: 0.96,
                      transition: { duration: 0.15 },
                    }}
                    initial={{ opacity: 0, y: 12 }}
                    key={`${skill.type}-${skill.id}`}
                    layout
                    transition={{ ...spring, delay: i * 0.04 }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{skill.id}</span>
                        <Badge variant="secondary">
                          {skill.type === "flat" ? "Flat" : "Packaged"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {skill.description || "（无描述）"}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                        {skill.path}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => openEditor(skill)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <PencilIcon className="size-3.5" />
                        <span className="sr-only">编辑 {skill.id}</span>
                      </Button>
                      <Button
                        onClick={() =>
                          requestDelete({ id: skill.id, type: skill.type })
                        }
                        size="icon-sm"
                        variant="ghost"
                      >
                        <TrashIcon className="size-3.5 text-destructive" />
                        <span className="sr-only">删除 {skill.id}</span>
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        )}
      </motion.div>

      {/* 新建 Skill 对话框 */}
      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>新建 Skill</DialogTitle>
            <DialogDescription>
              创建新的 Agent Skill，以 Markdown 编写，可包含 frontmatter 描述。
            </DialogDescription>
          </DialogHeader>
          <SkillForm
            onCancel={() => setCreateOpen(false)}
            onCreated={() => {
              setCreateOpen(false);
              mutate();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* 编辑 Skill 对话框 */}
      <Dialog onOpenChange={setEditorOpen} open={editorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>编辑 Skill</DialogTitle>
            <DialogDescription>
              {editing
                ? `编辑 ${editing.id}（${editing.type === "flat" ? "Flat" : "Packaged"}）`
                : "编辑 Skill 内容"}
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <SkillEditor
              onCancel={() => setEditorOpen(false)}
              onSaved={() => {
                setEditorOpen(false);
                mutate();
              }}
              skill={editing}
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
              确定要删除 Skill「{deleteTarget?.id}
              」吗？
              {deleteTarget?.type === "packaged"
                ? "Packaged 类型将递归删除整个目录及其所有资源，"
                : ""}
              此操作不可撤销。
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
