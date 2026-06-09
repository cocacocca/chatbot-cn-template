"use client";

import { AnimatePresence, motion, type Transition } from "framer-motion";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ModelConfig = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string | null;
  apiKey: string | null;
  capabilities: { tools: boolean; vision: boolean; reasoning: boolean };
  reasoningEffort: string | null;
  isDefault: boolean;
  isTitleModel: boolean;
};

type FormState = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  capabilities: { tools: boolean; vision: boolean; reasoning: boolean };
  reasoningEffort: string;
  isDefault: boolean;
  isTitleModel: boolean;
};

const emptyForm: FormState = {
  id: "",
  name: "",
  provider: "",
  baseUrl: "",
  apiKey: "",
  capabilities: { tools: true, vision: false, reasoning: false },
  reasoningEffort: "",
  isDefault: false,
  isTitleModel: false,
};

const spring: Transition = { type: "spring", damping: 25, stiffness: 300 };

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: spring,
};

export default function SettingsPage() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const data = await res.json();
        setModels(data.models ?? []);
      }
    } catch {
      toast.error("加载模型失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(model: ModelConfig) {
    setEditingId(model.id);
    setForm({
      ...model,
      baseUrl: model.baseUrl ?? "",
      apiKey: "",
      reasoningEffort: model.reasoningEffort ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.id || !form.name || !form.baseUrl || !form.apiKey) {
      toast.error("所有字段均为必填项");
      return;
    }

    const provider = form.provider || form.id.split("/")[0] || "";
    const payload = {
      ...form,
      provider,
      baseUrl: form.baseUrl,
      apiKey: form.apiKey,
      reasoningEffort: form.reasoningEffort || null,
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
        fetchModels();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "保存模型失败");
      }
    } catch {
      toast.error("保存模型失败");
    }
  }

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
        fetchModels();
      } else {
        toast.error("删除模型失败");
      }
    } catch {
      toast.error("删除模型失败");
    } finally {
      setDeleteId(null);
    }
  }

  if (loading) {
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
              配置用于聊天和标题生成的 AI 模型，每个模型可设置独立的 API Key 和
              Base URL。
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
                暂未配置模型，请添加一个模型开始使用。
              </p>
              <Button className="mt-4" onClick={openCreate} size="sm">
                <PlusIcon className="mr-1 size-4" />
                添加模型
              </Button>
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
                      {model.isDefault && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          默认
                        </span>
                      )}
                      {model.isTitleModel && (
                        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                          标题
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {model.id}
                      {model.baseUrl ? ` · ${model.baseUrl}` : ""}
                    </p>
                    <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
                      {model.capabilities.tools && (
                        <span className="rounded bg-muted px-1 py-0.5">
                          工具
                        </span>
                      )}
                      {model.capabilities.vision && (
                        <span className="rounded bg-muted px-1 py-0.5">
                          视觉
                        </span>
                      )}
                      {model.capabilities.reasoning && (
                        <span className="rounded bg-muted px-1 py-0.5">
                          推理
                        </span>
                      )}
                    </div>
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
          </DialogHeader>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
            initial={{ opacity: 0, y: 12 }}
            key={editingId ?? "create"}
            transition={{ type: "spring", damping: 25, stiffness: 320 }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">显示名称</Label>
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
              <Label htmlFor="id">模型 ID</Label>
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
          </motion.div>

          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)} variant="ghost">
              取消
            </Button>
            <Button onClick={handleSave}>{editingId ? "更新" : "添加"}</Button>
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
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除此模型吗？此操作不可撤销。
          </p>
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
