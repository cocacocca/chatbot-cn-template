/**
 * @file Agent 目录专用类型定义与工具函数
 * @description 从 lib/types-server.ts re-export 服务端类型，避免导入客户端模块（如 ai 包）。
 *   agent 目录是服务端模块，不能导入客户端模块（如 ai 包的 UIMessage）。
 * @module agent/lib/types
 */

// Re-export 服务端类型（不依赖 ai 包）
export type {
  ServerDocument as AgentDocument,
  ServerSession,
  ServerSuggestion as AgentSuggestion,
} from "@/lib/types-server";

/** 支持的 artifact 类型常量（与 lib/artifacts/server 保持一致） */
export const artifactKinds = ["text", "code", "sheet"] as const;

/**
 * 生成符合 UUID v4 规范的随机字符串（密码学安全）
 *
 * 使用 Node.js 19+ 全局 `crypto.randomUUID()` 替代基于 `Math.random()` 的
 * 手工实现。原实现非密码学安全，且每次调用产生新值，导致 persist-messages
 * hook 的 upsert 去重失效（每条消息都拿到全新 ID，永远走 insert 分支）。
 *
 * @returns UUID v4 字符串
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * 校验字符串是否为 UUID 格式。
 *
 * EVE 的 principalId 可能来自 supabaseAuth（真实用户 UUID）或 localDev
 * （固定字符串如 "local-dev"）。用非 UUID 去读写 user_id（uuid 类型）列
 * 会触发 Postgres "invalid input syntax for type uuid" 错误，因此查询前
 * 需先用本校验过滤。
 *
 * @param value 待校验字符串
 * @returns 是否为 UUID 格式
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}
