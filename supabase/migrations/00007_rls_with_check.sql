-- Migration: 为 UPDATE 策略补充 WITH CHECK
-- 用途：防止用户通过 UPDATE 把行修改为不属于自己 user_id 的值
-- 影响表：cct_user_profile, cct_chat, cct_message, cct_document, cct_suggestion
-- 注意：cct_model_config 的 UPDATE 策略在 00005 中已有 WITH CHECK，无需处理
--
-- 背景：
--   Supabase RLS 的 UPDATE 策略可包含 USING 和 WITH CHECK 两个子句：
--   - USING：决定哪些行可以被更新（基于更新前的数据）
--   - WITH CHECK：决定更新后的行是否合法（基于更新后的数据）
--   若 UPDATE 策略仅有 USING 而无 WITH CHECK，用户可将行更新为
--   不属于自己 user_id 的值，存在越权写风险。
--
-- 语法说明：
--   ALTER POLICY ... USING (...) WITH CHECK (...) 会替换原有的 USING 和
--   WITH CHECK 子句，故必须同时提供两者，否则会丢失原 USING 表达式。
--   本 migration 中每个 WITH CHECK 表达式均与原 USING 完全一致，
--   确保更新后的行仍归属原用户。

-- cct_user_profile: 确保更新后仍归属原用户
alter policy "users_update_own_profile"
  on public.cct_user_profile
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- cct_chat: 确保更新后 user_id 不变
alter policy "users_update_own_chat"
  on public.cct_chat
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- cct_message: 确保更新后仍属于当前用户的 chat
-- 注意：WITH CHECK 表达式与原 USING 一致，使用 cct_message.chat_id 前缀
alter policy "users_update_messages_in_own_chat"
  on public.cct_message
  using (
    exists (
      select 1 from public.cct_chat c
      where c.id = cct_message.chat_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cct_chat c
      where c.id = cct_message.chat_id and c.user_id = auth.uid()
    )
  );

-- cct_document: 确保更新后仍归属原用户
alter policy "users_update_own_documents"
  on public.cct_document
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- cct_suggestion: 确保更新后仍归属原用户
alter policy "users_update_own_suggestions"
  on public.cct_suggestion
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
