/**
 * @file EVE HTTP 通道配置
 * @description 配置 Agent 的 HTTP API 通道和认证策略
 * @module agent/channels/eve
 */

import { type AuthFn, localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Supabase Auth 验证策略
 *
 * 从 Request 的 Authorization header 中提取 Bearer token（JWT），
 * 使用 Supabase admin client 验证 token 并获取用户身份。
 * 如果用户已登录，返回 SessionAuthContext；否则返回 null。
 *
 * 注意：此实现不依赖 Next.js cookies，适用于 eve CLI 编译环境。
 *
 * @returns AuthFn - 返回认证函数
 */
function supabaseAuth(): AuthFn<Request> {
  return async (request: Request) => {
    try {
      // 从 Authorization header 提取 Bearer token
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return null;
      }

      const token = authHeader.slice(7); // 去掉 "Bearer " 前缀

      // 使用 Supabase admin client 验证 JWT
      const supabase = createAdminClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      // 如果有错误或用户不存在，跳过此策略
      if (error || !user) {
        return null;
      }

      // 返回完整的 SessionAuthContext
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
      console.error("[supabaseAuth] Error verifying user:", error);
      return null;
    }
  };
}

/**
 * EVE 通道默认配置
 *
 * 认证策略执行顺序（ordered auth walk）：
 * 1. supabaseAuth() - 优先检查 Supabase session（Bearer token 验证）
 * 2. localDev() - 本地开发环境（仅接受 loopback hostname）
 * 3. vercelOidc() - Vercel OIDC 验证（Vercel 部署环境）
 */
export default eveChannel({
  auth: [supabaseAuth(), localDev(), vercelOidc()],
});
