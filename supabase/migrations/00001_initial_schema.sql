-- 启用所需扩展
create extension if not exists "pgcrypto";

-- ---------- public.user_profile ----------
create table public.user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  image text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 注册时自动创建 user_profile 的触发器
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profile (id, name, image)
  values (new.id, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'image');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- public.chat ----------
create table public.chat (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  visibility varchar(20) not null default 'private'
    check (visibility in ('public', 'private')),
  created_at timestamptz not null default now()
);

create index on public.chat (user_id, created_at desc);

-- ---------- public.message ----------
create table public.message (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chat(id) on delete cascade,
  role varchar(20) not null,
  parts json,
  attachments json,
  created_at timestamptz not null default now()
);

create index on public.message (chat_id, created_at asc);

-- ---------- public.vote ----------
create table public.vote (
  chat_id uuid not null references public.chat(id) on delete cascade,
  message_id uuid not null references public.message(id) on delete cascade,
  is_upvoted boolean not null,
  primary key (chat_id, message_id)
);

-- ---------- public.document ----------
create table public.document (
  id uuid not null,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text,
  kind varchar(20) not null
    check (kind in ('text', 'code', 'image', 'sheet')),
  title text,
  primary key (id, created_at)
);

create index on public.document (user_id, created_at desc);

-- ---------- public.suggestion ----------
create table public.suggestion (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  document_created_at timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_text text,
  suggested_text text,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (document_id, document_created_at)
    references public.document(id, created_at) on delete cascade
);

-- ---------- public.model_config ----------
create table public.model_config (
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
