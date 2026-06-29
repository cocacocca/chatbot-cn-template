// import "server-only"; // 临时移除：eve CLI 与 server-only 存在兼容性问题
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * @file 服务端数据库查询封装
 *
 * 使用 admin 客户端（service_role 密钥）执行查询，绕过 RLS 策略。
 * 注意：移除 server-only 导入后，需确保此模块仅被服务端代码导入。
 */

/**
 * 获取当前登录用户的消息总数
 *
 * 调用数据库 RPC 函数 `cct_get_message_count_by_user_id`，
 * 该函数内部基于 `auth.uid()` 获取当前用户 ID 并统计其消息数量。
 *
 * @returns 当前用户的消息总数
 * @throws {PostgrestError} 当数据库查询失败时抛出原始错误
 */
export async function getMessageCountByUserId() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "cct_get_message_count_by_user_id"
  );
  if (error) {
    throw error;
  }
  return data as number;
}
