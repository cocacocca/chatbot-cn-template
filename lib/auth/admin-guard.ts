/** @file Admin API 鉴权守卫，校验当前请求的用户是否具有管理员角色 */
import { createClient } from "@/lib/supabase/server";

/**
 * 校验当前请求的用户是否为管理员
 *
 * 依赖 `cct_user_profile.role` 字段（migration 00006 添加）。
 * 使用受 RLS 约束的 server client，用户仅能查询自己的 profile
 * （RLS 策略 `users_select_own_profile`: using (auth.uid() = id)），
 * 因此查询结果即当前用户自身的角色，不存在越权查询风险。
 *
 * 失败语义（fail-closed，安全优先）：
 * - 未登录（无 user）→ 返回 null
 * - profile 查询失败（如 profile 不存在、数据库错误）→ 返回 null 并记录日志
 * - role 不为 'admin' → 返回 null
 *
 * @returns 管理员用户对象；非管理员或未登录时返回 null
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("cct_user_profile")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[admin-guard] Failed to query user profile:", error);
    return null;
  }

  return profile?.role === "admin" ? user : null;
}
