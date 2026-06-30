/** @file Skill 编辑器 - 编辑 skill 的 Markdown 内容并调用 PUT API 保存 */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SkillItem } from "@/hooks/data/use-skills";

/** SkillEditor 组件 props */
type SkillEditorProps = {
  skill: SkillItem;
  onCancel: () => void;
  onSaved: () => void;
};

/**
 * Skill 编辑器组件
 * 提供代码编辑区域（textarea + 等宽字体），保存时调用 PUT API
 * @param props.skill 待编辑的 skill
 * @param props.onCancel 取消回调
 * @param props.onSaved 保存成功回调
 */
export function SkillEditor({ skill, onCancel, onSaved }: SkillEditorProps) {
  // 使用初始 content 作为编辑起点；切换不同 skill 时由父级 unmount/mount 触发重置
  const [content, setContent] = useState(skill.content);
  const [saving, setSaving] = useState(false);

  /** 保存编辑内容，调用 PUT /api/admin/skills */
  async function handleSave() {
    if (!content.trim()) {
      toast.error("内容不能为空");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: skill.id,
          type: skill.type,
          content,
        }),
      });
      if (res.ok) {
        toast.success("Skill 已保存");
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
        aria-label={`编辑 ${skill.id} 的 Markdown 内容`}
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
