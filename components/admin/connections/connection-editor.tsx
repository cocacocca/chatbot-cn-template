/** @file Connection 编辑器 - 编辑 connection 的 TypeScript 代码并调用 PUT API 保存 */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ConnectionItem } from "@/hooks/data/use-connections";

/** ConnectionEditor 组件 props */
type ConnectionEditorProps = {
  connection: ConnectionItem;
  onCancel: () => void;
  onSaved: () => void;
};

/**
 * Connection 编辑器组件
 * 提供代码编辑区域（textarea + 等宽字体），保存时调用 PUT API
 * @param props.connection 待编辑的 connection
 * @param props.onCancel 取消回调
 * @param props.onSaved 保存成功回调
 */
export function ConnectionEditor({
  connection,
  onCancel,
  onSaved,
}: ConnectionEditorProps) {
  const [content, setContent] = useState(connection.content);
  const [saving, setSaving] = useState(false);

  /** 保存编辑内容，调用 PUT /api/admin/connections */
  async function handleSave() {
    if (!content.trim()) {
      toast.error("内容不能为空");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/connections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: connection.id, content }),
      });
      if (res.ok) {
        toast.success("Connection 已保存");
        onSaved();
      } else {
        const data = (await res.json().catch(() => ({
          error: "保存失败",
        }))) as { error?: string };
        toast.error(data.error ?? "保存失败");
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Textarea
        aria-label={`编辑 ${connection.id} 的代码`}
        className="min-h-[400px] resize-y font-mono text-xs"
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
        value={content}
      />
      <div className="flex justify-end gap-2">
        <Button disabled={saving} onClick={onCancel} variant="ghost">
          取消
        </Button>
        <Button disabled={saving} onClick={handleSave}>
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
