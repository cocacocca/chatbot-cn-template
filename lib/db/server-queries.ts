import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * @file 服务端数据库查询封装
 *
 * 使用 admin 客户端（service_role 密钥）执行查询，绕过 RLS 策略。
 * 通过 `import "server-only"` 保证此模块仅可在服务端代码中导入，
 * 避免敏感操作泄露至客户端 bundle。
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
