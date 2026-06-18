import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * @file Supabase 浏览器客户端创建（单例模式）
 *
 * 使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`（匿名密钥）创建客户端，
 * 所有请求受 RLS 策略约束，用户仅能访问自己拥有权限的数据。
 *
 * 使用场景：
 * - Client Components 中的数据读取/写入
 * - 浏览器端身份认证（登录、登出、会话刷新）
 * - Storage 文件上传/下载（受 RLS 约束）
 *
 * 采用单例模式：同一浏览器会话内复用同一客户端实例，
 * 避免重复初始化导致的内存泄漏与认证状态不一致。
 */

/** 浏览器客户端单例缓存 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null =
  null;

/**
 * 获取 Supabase 浏览器客户端单例
 *
 * 首次调用时创建客户端并缓存，后续调用直接返回缓存实例。
 *
 * @returns Supabase 浏览器客户端（anon 密钥，受 RLS 约束）
 */
export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}
