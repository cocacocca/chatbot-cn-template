/** @file Connection 创建表单 - 输入 id、type、url、description、tokenEnvVar 并调用 POST API */
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

/** Connection 类型 */
type ConnectionType = "mcp" | "openapi";

/** 表单字段状态 */
type FormState = {
  id: string;
  type: ConnectionType;
  url: string;
  description: string;
  tokenEnvVar: string;
};

/** 空表单初始值 */
const emptyForm: FormState = {
  id: "",
  type: "mcp",
  url: "",
  description: "",
  tokenEnvVar: "",
};

/** 文件名安全校验：仅允许字母、数字、连字符、下划线 */
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** ConnectionForm 组件 props */
type ConnectionFormProps = {
  onCancel: () => void;
  onCreated: () => void;
};

/**
 * Connection 创建表单组件
 * 收集用户输入并调用 POST /api/admin/connections 创建新 connection
 * @param props.onCancel 取消回调
 * @param props.onCreated 创建成功回调
 */
export function ConnectionForm({ onCancel, onCreated }: ConnectionFormProps) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  /** 更新表单指定字段 */
  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 提交表单，调用 POST API 创建 connection */
  async function handleSubmit() {
    // 必填校验
    if (!form.id || !form.description || !form.tokenEnvVar) {
      toast.error("请填写所有必填字段");
      return;
    }
    if (!form.url) {
      toast.error("请填写 URL");
      return;
    }
    if (!ID_PATTERN.test(form.id)) {
      toast.error("Connection 名只能包含字母、数字、连字符和下划线");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Connection 已创建");
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
        <Label htmlFor="conn-id">Connection 名 *</Label>
        <Input
          id="conn-id"
          onChange={(e) => updateField("id", e.target.value)}
          placeholder="例如 linear、github"
          value={form.id}
        />
        <p className="text-xs text-muted-foreground">
          作为文件名，只能包含字母、数字、连字符和下划线。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="conn-type">类型 *</Label>
        <Select
          onValueChange={(value) => {
            // 类型守卫：仅接受合法的 connection 类型
            if (value === "mcp" || value === "openapi") {
              updateField("type", value);
            }
          }}
          value={form.type}
        >
          <SelectTrigger className="w-full" id="conn-type">
            <SelectValue placeholder="选择类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mcp">MCP</SelectItem>
            <SelectItem value="openapi">OpenAPI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="conn-url">
          URL * {form.type === "mcp" ? "(MCP 服务地址)" : "(OpenAPI Spec 地址)"}
        </Label>
        <Input
          id="conn-url"
          onChange={(e) => updateField("url", e.target.value)}
          placeholder={
            form.type === "mcp"
              ? "例如 https://mcp.linear.app/sse"
              : "例如 https://petstore3.swagger.io/api/v3/openapi.json"
          }
          value={form.url}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="conn-desc">描述 *</Label>
        <Textarea
          id="conn-desc"
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="描述此 Connection 的用途，将展示给模型"
          value={form.description}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="conn-token">Token 环境变量名 *</Label>
        <Input
          id="conn-token"
          onChange={(e) => updateField("tokenEnvVar", e.target.value)}
          placeholder="例如 LINEAR_API_TOKEN"
          value={form.tokenEnvVar}
        />
        <p className="text-xs text-muted-foreground">
          代码模板将通过 process.env 读取此环境变量作为认证 Token。
        </p>
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
