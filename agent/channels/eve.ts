/**
 * @file EVE HTTP 通道配置
 * @description 配置 Agent 的 HTTP API 通道和认证策略
 * @module agent/channels/eve
 */

import { type AuthFn, localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase Auth 验证策略
 *
 * 从 Next.js cookies 中自动获取 Supabase session，验证用户身份。
 * 如果用户已登录，返回 SessionAuthContext；否则返回 null，让下一个策略处理。
 *
 * @returns AuthFn - 返回认证函数
 */
function supabaseAuth(): AuthFn<Request> {
  return async (_request: Request) => {
    try {
      // 创建 Supabase 客户端（自动从 cookies 获取 session）
      const supabase = await createClient();

      // 获取当前用户
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      // 如果有错误或用户不存在，跳过此策略
      if (error || !user) {
        return null;
      }

      // 返回完整的 SessionAuthContext
      // attributes 必须是 Record<string, string | readonly string[]>，不能包含 undefined
      const attributes: Record<string, string> = {};
      if (user.email) {
        attributes.email = user.email;
      }

      return {
        attributes,
        authenticator: "supabase",
        principalId: user.id,
        principalType: "user",
      };
    } catch (error) {
      // 发生异常时跳过此策略，让下一个策略处理
      console.error("[supabaseAuth] Error verifying user:", error);
      return null;
    }
  };
}

/**
 * EVE 通道默认配置
 *
 * 认证策略执行顺序（ordered auth walk）：
 * 1. supabaseAuth() - 优先检查 Supabase session（生产环境用户认证）
 * 2. localDev() - 本地开发环境（仅接受 loopback hostname）
 * 3. vercelOidc() - Vercel OIDC 验证（Vercel 部署环境）
 *
 * 每个策略可以：
 * - 返回 SessionAuthContext → 接受请求，停止 walk
 * - 返回 null/undefined → 跳过，继续下一个策略
 * - 抛出异常 → 拒绝请求
 */
export default eveChannel({
  auth: [supabaseAuth(), localDev(), vercelOidc()],
});
