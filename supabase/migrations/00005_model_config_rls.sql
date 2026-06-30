-- 子项目 A：数据安全层
-- 为 cct_model_config 启用 RLS，按用户隔离模型配置
-- 现有数据 user_id 设为 null（全局共享，所有用户可见但无法修改）
-- 新数据必须带 user_id

-- 加 user_id 字段
alter table public.cct_model_config
  add column user_id uuid references auth.users(id);

-- 启用 RLS
alter table public.cct_model_config enable row level security;

-- 策略：用户只能 CRUD 自己的模型配置
create policy "users_select_own_models"
  on public.cct_model_config for select
  using (auth.uid() = user_id);

create policy "users_insert_own_models"
  on public.cct_model_config for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_models"
  on public.cct_model_config for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_delete_own_models"
  on public.cct_model_config for delete
  using (auth.uid() = user_id);
