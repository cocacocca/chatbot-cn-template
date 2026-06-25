/** @file Skill 创建表单 - 输入 id、type、markdown 内容并调用 POST API */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** Skill 形态：flat 为单 .md 文件，packaged 为目录 + SKILL.md */
type SkillType = "flat" | "packaged";

/** 表单字段状态 */
type FormState = {
  id: string;
  type: SkillType;
  content: string;
};

/** 空表单初始值：提供一段 frontmatter + 描述占位，便于用户上手 */
const emptyForm: FormState = {
  id: "",
  type: "flat",
  content: "",
};

/**
 * 文件名/目录名安全校验：仅允许小写字母、数字、连字符
 * 与 API 端 ID_PATTERN 保持一致
 */
const ID_PATTERN = /^[a-z0-9-]+$/;

/** SkillForm 组件 props */
type SkillFormProps = {
  onCancel: () => void;
  onCreated: () => void;
};

/**
 * Skill 创建表单组件
 * 收集用户输入并调用 POST /api/admin/skills 创建新 skill
 * @param props.onCancel 取消回调
 * @param props.onCreated 创建成功回调
 */
export function SkillForm({ onCancel, onCreated }: SkillFormProps) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  /** 更新表单指定字段 */
  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 提交表单，调用 POST API 创建 skill */
  async function handleSubmit() {
    // 必填校验
    if (!form.id) {
      toast.error("请填写 Skill 名");
      return;
    }
    if (!form.content.trim()) {
      toast.error("请填写 Skill 内容");
      return;
    }
    if (!ID_PATTERN.test(form.id)) {
      toast.error("Skill 名只能包含小写字母、数字和连字符");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Skill 已创建");
        setForm(emptyForm);
        onCreated();
      } else {
        const data = (await res.json().catch(() => ({
          error: "创建失败",
        }))) as { error?: string };
        toast.error(data.error ?? "创建失败");
      }
    } catch {
      toast.error("创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="skill-id">Skill 名 *</Label>
        <Input
          id="skill-id"
          onChange={(e) => updateField("id", e.target.value)}
          placeholder="例如 research、code-review"
          value={form.id}
        />
        <p className="text-xs text-muted-foreground">
          作为文件名或目录名，只能包含小写字母、数字和连字符。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill-type">类型 *</Label>
        <Select
          onValueChange={(value) => {
            // 类型守卫：仅接受合法的 skill 类型
            if (value === "flat" || value === "packaged") {
              updateField("type", value);
            }
          }}
          value={form.type}
        >
          <SelectTrigger className="w-full" id="skill-type">
            <SelectValue placeholder="选择类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flat">Flat（单文件）</SelectItem>
            <SelectItem value="packaged">Packaged（目录）</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {form.type === "flat"
            ? "Flat：在 agent/skills/ 下创建单个 .md 文件。"
            : "Packaged：在 agent/skills/<id>/ 下创建含 SKILL.md 的目录，便于附带资源。"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill-content">内容（Markdown）*</Label>
        <Textarea
          aria-label="Skill Markdown 内容"
          className="min-h-[320px] resize-y font-mono text-xs"
          id="skill-content"
          onChange={(e) => updateField("content", e.target.value)}
          placeholder={
            "可使用 frontmatter，例如：\n---\ndescription: 此 skill 的用途说明。\n---\n\nUse when the user needs to ..."
          }
          spellCheck={false}
          value={form.content}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button disabled={submitting} onClick={onCancel} variant="ghost">
          取消
        </Button>
        <Button disabled={submitting} onClick={handleSubmit}>
          {submitting ? "创建中..." : "创建"}
        </Button>
      </div>
    </div>
  );
}
