/** @file 模型设置页面：管理用户自定义的 AI 模型配置（增删改查 + 连接测试） */
"use client";

import { AnimatePresence, motion, type Transition } from "framer-motion";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModels } from "@/hooks/data/use-models";
import { cn } from "@/lib/utils";

/** 模型表单状态 */
type FormState = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
};

/** 空表单初始值 */
const emptyForm: FormState = {
  id: "",
  name: "",
  baseUrl: "",
  apiKey: "",
};

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
 * 模型设置页面组件
 * 提供模型列表展示、添加/编辑/删除操作，以及 API 连接测试。
 */
export default function SettingsPage() {
  const { models, isLoading, mutate } = useModels();

  // 对话框与表单状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  /** 使模型列表缓存失效，触发重新拉取 */
  function invalidateModels() {
    mutate();
  }

  /** 打开「添加模型」对话框：重置表单与测试结果 */
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setTestResult(null);
    setDialogOpen(true);
  }

  /** 打开「编辑模型」对话框：用现有模型数据填充表单 */
  function openEdit(model: (typeof models)[number]) {
    setEditingId(model.id);
    setForm({
      id: model.id,
      name: model.name,
      baseUrl: model.baseUrl ?? "",
      apiKey: "",
    });
    setTestResult(null);
    setDialogOpen(true);
  }

  /** 测试 API 连接：调用 /api/models/test 验证 baseUrl 与 apiKey */
  async function handleTest() {
    if (!form.baseUrl || !form.apiKey) {
      toast.error("请先填写 Base URL 和 API Key");
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: form.baseUrl, apiKey: form.apiKey }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: "请求失败" });
    } finally {
      setTestLoading(false);
    }
  }

  /** 保存模型：根据 editingId 决定调用 PUT（更新）或 POST（新建） */
  async function handleSave() {
    if (!form.id || !form.name || !form.baseUrl || !form.apiKey) {
      toast.error("所有字段均为必填项");
      return;
    }

    // 从模型 ID 中提取 provider（如 "deepseek/deepseek-chat" → "deepseek"）
    const provider = form.id.split("/")[0] || "";
    const payload = {
      ...form,
      provider,
      capabilities: { tools: true, vision: false, reasoning: false },
      reasoningEffort: null,
      isDefault: false,
      isTitleModel: false,
    };

    try {
      const res = editingId
        ? await fetch("/api/models", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        toast.success(editingId ? "模型已更新" : "模型已添加");
        setDialogOpen(false);
        invalidateModels();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "保存模型失败");
      }
    } catch {
      toast.error("保存模型失败");
    }
  }

  /** 确认删除模型：调用 DELETE /api/models?id=... */
  async function confirmDelete() {
    if (!deleteId) {
      return;
    }

    try {
      const res = await fetch(
        `/api/models?id=${encodeURIComponent(deleteId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("模型已删除");
        invalidateModels();
      } else {
        toast.error("删除模型失败");
      }
    } catch {
      toast.error("删除模型失败");
    } finally {
      setDeleteId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <motion.p
          animate={{ opacity: 1 }}
          className="text-muted-foreground"
          initial={{ opacity: 0 }}
        >
          加载中...
        </motion.p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background min-h-dvh">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-4xl p-8"
        initial={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 25, stiffness: 280 }}
      >
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">模型设置</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              配置用于聊天的 AI 模型，每个模型可设置独立的 API Key 和 Base URL。
            </p>
          </div>
          <Button onClick={openCreate} size="sm">
            <PlusIcon className="mr-1 size-4" />
            添加模型
          </Button>
        </div>

        <AnimatePresence mode="popLayout">
          {models.length === 0 ? (
            <motion.div
              key="empty"
              {...fadeUp}
              className="rounded-lg border border-dashed border-border/50 p-8 text-center"
            >
              <p className="text-muted-foreground">
                暂未配置模型，点击上方「添加模型」按钮开始使用。
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {models.map((model, i) => (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-4"
                  exit={{
                    opacity: 0,
                    scale: 0.96,
                    transition: { duration: 0.15 },
                  }}
                  initial={{ opacity: 0, y: 12 }}
                  key={model.id}
                  layout
                  transition={{ ...spring, delay: i * 0.04 }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {model.id}
                      {model.baseUrl ? ` · ${model.baseUrl}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => openEdit(model)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                    <Button
                      onClick={() => setDeleteId(model.id)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <TrashIcon className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 编辑/添加对话框 */}
      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑模型" : "添加模型"}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingId ? "编辑模型配置" : "添加新的 AI 模型配置"}
            </DialogDescription>
          </DialogHeader>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
            initial={{ opacity: 0, y: 12 }}
            key={editingId ?? "create"}
            transition={{ type: "spring", damping: 25, stiffness: 320 }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">显示名称 *</Label>
              <Input
                id="name"
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="例如 DeepSeek Chat"
                value={form.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="id">模型 ID *</Label>
              <Input
                disabled={!!editingId}
                id="id"
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                placeholder="例如 deepseek/deepseek-chat"
                value={form.id}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL *</Label>
              <Input
                id="baseUrl"
                onChange={(e) =>
                  setForm((f) => ({ ...f, baseUrl: e.target.value }))
                }
                placeholder="例如 https://api.deepseek.com/v1"
                value={form.baseUrl}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key *</Label>
              <Input
                id="apiKey"
                onChange={(e) =>
                  setForm((f) => ({ ...f, apiKey: e.target.value }))
                }
                placeholder="输入 API Key"
                type="password"
                value={form.apiKey}
              />
            </div>

            {testResult && (
              <motion.p
                animate={{ opacity: 1 }}
                className={cn(
                  "text-xs",
                  testResult.success ? "text-green-600" : "text-destructive"
                )}
                initial={{ opacity: 0 }}
              >
                {testResult.message}
              </motion.p>
            )}
          </motion.div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <Button
              disabled={testLoading}
              onClick={handleTest}
              size="sm"
              variant="outline"
            >
              {testLoading ? "测试中..." : "测试连接"}
            </Button>
            <div className="flex gap-2">
              <Button onClick={() => setDialogOpen(false)} variant="ghost">
                取消
              </Button>
              <Button onClick={handleSave}>
                {editingId ? "更新" : "添加"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
          }
        }}
        open={deleteId !== null}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除此模型吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteId(null)} variant="ghost">
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
