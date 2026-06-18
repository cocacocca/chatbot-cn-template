import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * @file Supabase Admin 客户端创建
 *
 * 使用 `SUPABASE_SERVICE_ROLE_KEY`（服务角色密钥）创建客户端，
 * 该密钥拥有数据库完全访问权限，**绕过所有 RLS 策略**。
 *
 * 使用场景：
 * - 服务端需要执行跨用户查询或写入（如统计、后台任务）
 * - 调用 RPC 函数且函数内部依赖 `auth.uid()` 时（需配合自定义鉴权逻辑）
 *
 * 安全警告：
 * - service_role 密钥绝不能暴露到客户端 bundle
 * - 仅可在服务端代码（Server Components / Route Handlers / Server Actions）中使用
 * - 调用方需自行确保操作合法性，RLS 不会提供保护
 */

/**
 * 创建 Supabase Admin 客户端
 *
 * @returns 使用 service_role 密钥的 Supabase 客户端，绕过 RLS
 */
export function createAdminClient() {
  return createClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // admin 客户端不维护用户会话，禁用持久化与自动刷新
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
