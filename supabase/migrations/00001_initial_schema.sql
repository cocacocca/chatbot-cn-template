-- 启用所需扩展
create extension if not exists "pgcrypto";

-- ---------- public.cct_user_profile ----------
create table public.cct_user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  image text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 注册时自动创建 cct_user_profile 的触发器
create or replace function public.cct_handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.cct_user_profile (id, name, image)
  values (new.id, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'image');
  return new;
end;
$$;

create trigger cct_on_auth_user_created
  after insert on auth.users
  for each row execute function public.cct_handle_new_user();

-- ---------- public.cct_chat ----------
create table public.cct_chat (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  visibility varchar(20) not null default 'private'
    check (visibility in ('public', 'private')),
  created_at timestamptz not null default now()
);

create index on public.cct_chat (user_id, created_at desc);

-- ---------- public.cct_message ----------
create table public.cct_message (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.cct_chat(id) on delete cascade,
  role varchar(20) not null,
  parts json,
  attachments json,
  created_at timestamptz not null default now()
);

create index on public.cct_message (chat_id, created_at asc);

-- ---------- public.cct_vote ----------
create table public.cct_vote (
  chat_id uuid not null references public.cct_chat(id) on delete cascade,
  message_id uuid not null references public.cct_message(id) on delete cascade,
  is_upvoted boolean not null,
  primary key (chat_id, message_id)
);

-- ---------- public.cct_document ----------
create table public.cct_document (
  id uuid not null,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text,
  kind varchar(20) not null
    check (kind in ('text', 'code', 'image', 'sheet')),
  title text,
  primary key (id, created_at)
);

create index on public.cct_document (user_id, created_at desc);

-- ---------- public.cct_suggestion ----------
create table public.cct_suggestion (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  document_created_at timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_text text,
  suggested_text text,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (document_id, document_created_at)
    references public.cct_document(id, created_at) on delete cascade
);

-- ---------- public.cct_model_config ----------
create table public.cct_model_config (
  id text primary key,
  provider text not null,
  base_url text,
  api_key text,
  capabilities json,
  reasoning_effort text,
  is_default boolean not null default false,
  is_title_model boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
