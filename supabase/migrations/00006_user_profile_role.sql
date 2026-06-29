-- Migration: 为 cct_user_profile 添加 role 字段
-- 用途：支持管理员鉴权，requireAdmin() 守卫（lib/auth/admin-guard.ts）依赖此字段
-- 默认值 'user'（普通用户），管理员为 'admin'
--
-- 说明：
--   新增 role 字段，类型 text not null default 'user'。
--   CHECK 约束限制 role 只能为 'user' 或 'admin'，防止非法值写入。
--   已存在的用户行会被 default 自动回填为 'user'（PostgreSQL ADD COLUMN DEFAULT 行为），
--   无需额外回填语句。
--   新用户注册时由 cct_handle_new_user 触发器（见 00001）插入 profile，
--   触发器未显式插入 role，将使用 default 值 'user'。
--
-- 安全说明：
--   role 字段受 cct_user_profile 现有 RLS 策略保护（见 00002），
--   用户仅能查询/更新自己的 profile，无法越权修改自身角色。
--   管理员角色的授予应通过受信任的路径（如 service_role 客户端或 SQL）进行。

alter table public.cct_user_profile
  add column role text not null default 'user';

alter table public.cct_user_profile
  add constraint cct_user_profile_role_check check (role in ('user', 'admin'));

comment on column public.cct_user_profile.role is '管理员鉴权字段：user（普通用户，默认）或 admin（管理员）';
