import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * @file Supabase 服务端客户端创建（SSR）
 *
 * 使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`（匿名密钥）创建客户端，
 * 通过 Next.js 的 `cookies()` 读取用户会话并透传给 Supabase，
 * 所有请求受 RLS 策略约束（基于当前登录用户身份）。
 *
 * 使用场景：
 * - Server Components 中的数据读取
 * - Route Handlers / Server Actions 中的数据写入
 * - 服务端鉴权校验（`getUser()`）
 *
 * 与 admin 客户端的区别：
 * - 使用 anon 密钥而非 service_role 密钥
 * - 受 RLS 约束，仅能访问当前用户有权访问的数据
 * - 通过 cookies 维持用户会话状态
 */

/**
 * 创建 Supabase 服务端客户端
 *
 * 从 Next.js `cookies()` 异步读取请求的 cookie 存储，
 * 将其透传给 `createServerClient`，使 Supabase 能识别当前用户身份。
 *
 * @returns Supabase 服务端客户端（anon 密钥，受 RLS 约束）
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 读取所有 cookie，供 Supabase 客户端识别用户会话
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // 在 Server Component 中调用 setAll 会抛错，可忽略
            // Route Handler 中正常工作
          }
        },
      },
    }
  );
}
