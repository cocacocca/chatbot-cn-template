import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * @file 服务端数据库查询封装
 *
 * 使用 server 客户端（anon 密钥 + 用户 session）执行查询，受 RLS 策略约束。
 * 通过 `import "server-only"` 在构建期防止此模块被客户端代码导入（已验证兼容 eve 0.17.0）。
 */

/**
 * 获取当前登录用户的消息总数
 *
 * 调用数据库 RPC 函数 `cct_get_message_count_by_user_id`，
 * 该函数内部基于 `auth.uid()` 获取当前用户 ID 并统计其消息数量。
 * 使用 server client（带用户 session）使 `auth.uid()` 正常工作。
 *
 * @returns 当前用户的消息总数
 * @throws {PostgrestError} 当数据库查询失败时抛出原始错误
 */
export async function getMessageCountByUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "cct_get_message_count_by_user_id"
  );
  if (error) {
    throw error;
  }
  return data as number;
}
