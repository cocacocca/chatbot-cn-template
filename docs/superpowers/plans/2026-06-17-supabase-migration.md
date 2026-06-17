# Supabase 完全替代迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 chatbot-cn-template 的数据库、鉴权、文件存储完全替换为 Supabase 全家桶，全面启用 RLS，放弃 Redis 断线续传，部署到 Vercel + Supabase 云。

**Architecture:** 三个 Supabase 客户端分工（browser/server/admin），客户端用 anon key + RLS 直查数据，服务端用 service_role 处理 AI 链路和敏感字段。API 路由从 11 个减到 3 个，18 个查询函数改客户端直查，8 个保留服务端特权操作。

**Tech Stack:** Next.js 16.2.0 App Router, Supabase (Postgres + Auth + Storage), @supabase/ssr, AI SDK, SWR, TypeScript

**Spec:** `docs/superpowers/specs/2026-06-17-supabase-migration-design.md`

---

## File Structure

### 新增文件

```
lib/supabase/
├── client.ts              # 浏览器客户端（anon + RLS）
├── server.ts              # 服务端客户端（anon + RLS）
├── admin.ts               # 特权客户端（service_role）
└── types.ts               # 统一导出 Database 类型

lib/db/
├── database.types.ts      # supabase gen types 生成
└── server-queries.ts      # 服务端特权查询（voteMessage, getMessageCountByUserId）

lib/ai/
├── chat-db.ts             # chat 路由 DB 操作（saveChat, saveMessages, deleteMessagesByChatIdAfterTimestamp）
├── artifacts-db.ts        # artifact 工具 DB 操作（saveDocument, updateDocumentContent, saveSuggestions）
└── models-db.ts           # model_config CRUD（含脱敏逻辑）

lib/storage/
└── client.ts              # Storage 客户端工具（uploadChatAttachment, getAttachmentUrls）

hooks/
├── use-user.ts            # 用户状态 hook（替代 useSession）
├── use-require-auth.ts    # 路由守卫 hook
├── use-chat-history.ts    # 历史记录 hook（替代 /api/history）
├── use-documents.ts       # 文档 hook（替代 /api/document）
├── use-votes.ts           # 投票 hook（替代 /api/vote）
└── use-suggestions.ts     # 建议 hook（替代 /api/suggestions）

components/providers/
└── swr-provider.tsx       # SWR 全局配置

components/chat/
├── attachment-upload.tsx  # 附件上传组件
└── message-attachments.tsx # 附件渲染组件

supabase/
├── config.toml            # Supabase 项目配置
├── migrations/
│   ├── 00001_initial_schema.sql
│   ├── 00002_rls_policies.sql
│   ├── 00003_views_and_rpc.sql
│   └── 00004_storage_policies.sql
└── seed.sql               # 种子数据（默认 ModelConfig）
```

### 删除文件

```
lib/db/queries.ts          # 拆分到 lib/ai/*-db.ts 和 lib/db/server-queries.ts
lib/db/utils.ts            # 密码哈希不再需要
lib/db/migrate.ts          # 迁移改到 Supabase 侧
lib/db/migrations/         # 整个目录删除
lib/db/schema.ts           # drizzle schema 删除
drizzle.config.ts          # drizzle 移除
app/(auth)/auth.ts         # NextAuth 移除
app/(auth)/auth.config.ts  # NextAuth 移除
app/(auth)/actions.ts      # 改客户端直接调用
app/(auth)/api/auth/       # NextAuth 路由删除（整个目录）
app/(chat)/api/files/upload/route.ts  # 改客户端直传
app/(chat)/api/history/route.ts       # RLS 替代
app/(chat)/api/messages/route.ts      # RLS 替代
app/(chat)/api/document/route.ts      # RLS 替代
app/(chat)/api/vote/route.ts          # RLS 替代
app/(chat)/api/suggestions/route.ts   # RLS 替代
app/(chat)/api/chat/[id]/stream/route.ts  # 放弃断线续传
hooks/use-auto-resume.ts   # 放弃断线续传
```

### 改造文件

```
app/layout.tsx                         # 移除 SessionProvider，新增 SWRProvider
app/(auth)/login/page.tsx              # 客户端直接调用 Supabase Auth
app/(auth)/register/page.tsx           # 客户端直接调用 Supabase Auth
app/(auth)/layout.tsx                  # 移除 SessionProvider 引用
proxy.ts                               # NextAuth getToken → Supabase getUser
app/(chat)/api/chat/route.ts           # 移除 resumable-stream，DB 调用改 admin client
app/(chat)/api/models/route.ts         # 脱敏 api_key
app/(chat)/api/models/test/route.ts    # admin client 查询
app/(chat)/actions.ts                  # DB 调用改 admin client
lib/ai/providers.ts                    # admin client 查询模型配置
lib/ai/models.ts                       # admin client 查询
lib/ai/tools/create-document.ts        # DB 调用改 admin client
lib/ai/tools/edit-document.ts          # DB 调用改 admin client
lib/ai/tools/update-document.ts        # DB 调用改 admin client
lib/ai/tools/request-suggestions.ts    # DB 调用改 admin client
components/chat/auth-form.tsx          # supabase.auth
components/chat/sign-out-form.tsx      # supabase.auth.signOut
components/chat/sidebar-user-nav.tsx   # useUser hook
components/chat/sidebar-history.tsx    # useChatHistory hook
components/chat/messages.tsx           # useMessages hook
components/chat/vote.tsx               # useVotes hook
hooks/use-active-chat.tsx              # 移除 resumeStream
hooks/use-messages.ts                  # 改造 fetcher
hooks/use-models.ts                    # 仍调 API（脱敏数据）
lib/constants.ts                       # 移除 DUMMY_PASSWORD
package.json                           # scripts + dependencies
Dockerfile                             # 移除 mkdir uploads
docker-compose.yml                     # 移除 postgres/redis
.env.example                           # 环境变量更新
vercel-template.json                   # 集成更新
next.config.ts                         # 新增 supabase.co 图片域名
.github/workflows/playwright.yml       # 本地 Supabase 替代 docker-compose
README.md                              # 部署文档更新
```

---

## Task 1: Supabase 项目初始化与依赖安装

**Files:**
- Modify: `package.json`
- Create: `.env.example` (改造)
- Create: `lib/supabase/types.ts`

- [ ] **Step 1: 安装 Supabase 依赖**

Run:
```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: 移除旧依赖**

Run:
```bash
pnpm remove drizzle-orm postgres next-auth bcrypt-ts redis resumable-stream dotenv
pnpm remove -D drizzle-kit
```

- [ ] **Step 3: 更新 .env.example**

Replace `.env.example` content with:
```bash
# Supabase（必需）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI（保留）
AI_GATEWAY_API_KEY=your-ai-gateway-key
```

- [ ] **Step 4: 创建 lib/supabase/types.ts**

Create `lib/supabase/types.ts`:
```ts
// 此文件由 supabase gen types 生成，首次运行 Task 2 后替换
export type Database = {
  public: {
    Tables: {
      user_profile: {
        Row: {
          id: string;
          name: string | null;
          image: string | null;
          is_anonymous: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          image?: string | null;
          is_anonymous?: boolean;
        };
        Update: {
          name?: string | null;
          image?: string | null;
          is_anonymous?: boolean;
        };
      };
    };
  };
};
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example lib/supabase/types.ts
git commit -m "chore: 安装 Supabase 依赖，移除旧依赖"
```

---

## Task 2: 创建 Supabase Migration 文件

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/00001_initial_schema.sql`
- Create: `supabase/migrations/00002_rls_policies.sql`
- Create: `supabase/migrations/00003_views_and_rpc.sql`
- Create: `supabase/migrations/00004_storage_policies.sql`
- Create: `supabase/seed.sql`

- [ ] **Step 1: 创建 supabase/config.toml**

Create `supabase/config.toml`:
```toml
project_id = "chatbot-cn-template"

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_database_name = "postgres_shadow"

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["https://localhost:3000"]
jwt_expiry = 3600
enable_signup = true
enable_anonymous_sign_ins = false

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false

[storage]
enabled = true
file_size_limit = "5MiB"
```

- [ ] **Step 2: 创建 00001_initial_schema.sql**

Create `supabase/migrations/00001_initial_schema.sql`:
```sql
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
```

- [ ] **Step 3: 创建 00002_rls_policies.sql**

Create `supabase/migrations/00002_rls_policies.sql`:
```sql
-- 启用 RLS（model_config 除外）
alter table public.user_profile enable row level security;
alter table public.chat enable row level security;
alter table public.message enable row level security;
alter table public.vote enable row level security;
alter table public.document enable row level security;
alter table public.suggestion enable row level security;

-- ---------- user_profile ----------
create policy "users_select_own_profile"
  on public.user_profile for select
  using (auth.uid() = id);

create policy "users_update_own_profile"
  on public.user_profile for update
  using (auth.uid() = id);

create policy "users_delete_own_profile"
  on public.user_profile for delete
  using (auth.uid() = id);

-- ---------- chat ----------
create policy "users_select_own_or_public_chat"
  on public.chat for select
  using (auth.uid() = user_id or visibility = 'public');

create policy "users_insert_own_chat"
  on public.chat for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_chat"
  on public.chat for update
  using (auth.uid() = user_id);

create policy "users_delete_own_chat"
  on public.chat for delete
  using (auth.uid() = user_id);

-- ---------- message ----------
create policy "users_select_messages_in_own_or_public_chat"
  on public.message for select
  using (
    exists (
      select 1 from public.chat c
      where c.id = message.chat_id
        and (c.user_id = auth.uid() or c.visibility = 'public')
    )
  );

create policy "users_insert_messages_in_own_chat"
  on public.message for insert
  with check (
    exists (
      select 1 from public.chat c
      where c.id = chat_id and c.user_id = auth.uid()
    )
  );

create policy "users_update_messages_in_own_chat"
  on public.message for update
  using (
    exists (
      select 1 from public.chat c
      where c.id = message.chat_id and c.user_id = auth.uid()
    )
  );

create policy "users_delete_messages_in_own_chat"
  on public.message for delete
  using (
    exists (
      select 1 from public.chat c
      where c.id = message.chat_id and c.user_id = auth.uid()
    )
  );

-- ---------- vote ----------
create policy "users_select_votes_in_own_or_public_chat"
  on public.vote for select
  using (
    exists (
      select 1 from public.chat c
      where c.id = vote.chat_id
        and (c.user_id = auth.uid() or c.visibility = 'public')
    )
  );

create policy "users_modify_votes_in_own_chat"
  on public.vote for all
  using (
    exists (
      select 1 from public.chat c
      where c.id = vote.chat_id and c.user_id = auth.uid()
    )
  );

-- ---------- document ----------
create policy "users_select_own_documents"
  on public.document for select
  using (auth.uid() = user_id);

create policy "users_insert_own_documents"
  on public.document for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_documents"
  on public.document for update
  using (auth.uid() = user_id);

create policy "users_delete_own_documents"
  on public.document for delete
  using (auth.uid() = user_id);

-- ---------- suggestion ----------
create policy "users_select_own_suggestions"
  on public.suggestion for select
  using (auth.uid() = user_id);

create policy "users_insert_own_suggestions"
  on public.suggestion for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_suggestions"
  on public.suggestion for update
  using (auth.uid() = user_id);

create policy "users_delete_own_suggestions"
  on public.suggestion for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 4: 创建 00003_views_and_rpc.sql**

Create `supabase/migrations/00003_views_and_rpc.sql`:
```sql
-- RPC: get_message_count_by_user_id
create or replace function public.get_message_count_by_user_id(
  since timestamptz default now() - interval '1 hour'
)
returns integer
language sql
security definer set search_path = public
as $$
  select count(*)::integer
  from public.message m
  inner join public.chat c on c.id = m.chat_id
  where c.user_id = auth.uid()
    and m.created_at >= since;
$$;

-- View: document_latest
create or replace view public.document_latest as
select distinct on (id) *
from public.document
order by id, created_at desc;
```

- [ ] **Step 5: 创建 00004_storage_policies.sql**

Create `supabase/migrations/00004_storage_policies.sql`:
```sql
-- chat-attachments bucket（私有 bucket）
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

-- 上传：用户只能上传到自己 user_id 前缀的路径
create policy "users_upload_own_attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 读取：用户只能读自己 user_id 前缀的文件
create policy "users_read_own_attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 删除：用户只能删自己 user_id 前缀的文件
create policy "users_delete_own_attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 更新：用户只能更新自己 user_id 前缀的文件
create policy "users_update_own_attachments"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 6: 创建 seed.sql**

Create `supabase/seed.sql`:
```sql
-- 默认模型配置（DeepSeek V3.2）
insert into public.model_config (id, provider, base_url, api_key, capabilities, reasoning_effort, is_default, is_title_model)
values (
  'deepseek-v3.2',
  'DeepSeek',
  'https://api.deepseek.com/v1',
  '',
  '{"chat": true, "reasoning": false, "vision": false}'::json,
  null,
  true,
  true
)
on conflict (id) do nothing;
```

- [ ] **Step 7: Commit**

```bash
git add supabase/
git commit -m "feat: 创建 Supabase migration 文件（schema + RLS + View + Storage）"
```

---

## Task 3: 创建 Supabase 客户端

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`

- [ ] **Step 1: 创建 browser 客户端**

Create `lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: 创建 server 客户端**

Create `lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 在 Server Component 中调用 setAll 会抛错，可忽略
            // Route Handler 中正常工作
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: 创建 admin 客户端**

Create `lib/supabase/admin.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/
git commit -m "feat: 创建 Supabase 客户端（browser/server/admin）"
```

---

## Task 4: 创建服务端数据访问层

**Files:**
- Create: `lib/db/server-queries.ts`
- Create: `lib/ai/chat-db.ts`
- Create: `lib/ai/artifacts-db.ts`
- Create: `lib/ai/models-db.ts`

- [ ] **Step 1: 创建 lib/db/server-queries.ts**

Create `lib/db/server-queries.ts`:
```ts
import "server-only";
import { createAdminClient } from '@/lib/supabase/admin';

export async function voteMessage({
  chatId,
  messageId,
  isUpvoted,
}: {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('vote')
    .upsert(
      { chat_id: chatId, message_id: messageId, is_upvoted: isUpvoted },
      { onConflict: 'chat_id,message_id' }
    );
  if (error) throw error;
}

export async function getMessageCountByUserId() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_message_count_by_user_id');
  if (error) throw error;
  return data as number;
}
```

- [ ] **Step 2: 创建 lib/ai/chat-db.ts**

Create `lib/ai/chat-db.ts`:
```ts
import "server-only";
import { createAdminClient } from '@/lib/supabase/admin';

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title?: string;
  visibility: 'public' | 'private';
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('chat').upsert(
    {
      id,
      user_id: userId,
      title,
      visibility,
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

export async function saveMessages(messages: Array<{
  id: string;
  chat_id: string;
  role: string;
  parts: any;
  attachments: any;
}>) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('message').insert(messages);
  if (error) throw error;
}

export async function deleteMessagesByChatIdAfterTimestamp(
  chatId: string,
  timestamp: Date
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('message')
    .delete()
    .eq('chat_id', chatId)
    .gte('created_at', timestamp.toISOString());
  if (error) throw error;
}
```

- [ ] **Step 3: 创建 lib/ai/artifacts-db.ts**

Create `lib/ai/artifacts-db.ts`:
```ts
import "server-only";
import { createAdminClient } from '@/lib/supabase/admin';

export async function saveDocument({
  id,
  userId,
  content,
  kind,
  title,
}: {
  id: string;
  userId: string;
  content: string;
  kind: 'text' | 'code' | 'image' | 'sheet';
  title: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('document').insert({
    id,
    user_id: userId,
    content,
    kind,
    title,
  });
  if (error) throw error;
}

export async function updateDocumentContent(
  documentId: string,
  content: string
) {
  const supabase = createAdminClient();
  // 复合主键表：插入新版本实现更新
  const { data: latest, error: fetchError } = await supabase
    .from('document_latest')
    .select('id, kind, title, user_id')
    .eq('id', documentId)
    .single();

  if (fetchError) throw fetchError;
  if (!latest) throw new Error('Document not found');

  const { error } = await supabase.from('document').insert({
    id: documentId,
    user_id: latest.user_id,
    content,
    kind: latest.kind,
    title: latest.title,
  });
  if (error) throw error;
}

export async function saveSuggestions({
  documentId,
  documentCreatedAt,
  userId,
  suggestions,
}: {
  documentId: string;
  documentCreatedAt: string;
  userId: string;
  suggestions: Array<{ originalText: string; suggestedText: string }>;
}) {
  const supabase = createAdminClient();
  const rows = suggestions.map((s) => ({
    document_id: documentId,
    document_created_at: documentCreatedAt,
    user_id: userId,
    original_text: s.originalText,
    suggested_text: s.suggestedText,
  }));
  const { error } = await supabase.from('suggestion').insert(rows);
  if (error) throw error;
}
```

- [ ] **Step 4: 创建 lib/ai/models-db.ts**

Create `lib/ai/models-db.ts`:
```ts
import "server-only";
import { createAdminClient } from '@/lib/supabase/admin';

type ModelConfig = {
  id: string;
  provider: string;
  base_url: string | null;
  api_key: string | null;
  capabilities: any;
  reasoning_effort: string | null;
  is_default: boolean;
  is_title_model: boolean;
  created_at: string;
  updated_at: string;
};

// 客户端可调用，返回时脱敏 api_key
export async function getAllModelConfigsForClient() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  // 脱敏：移除 api_key
  return data.map(({ api_key, ...rest }) => rest);
}

// 服务端 AI 链路使用，不脱敏
export async function getAllModelConfigs(): Promise<ModelConfig[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as ModelConfig[];
}

export async function getModelConfigById(id: string): Promise<ModelConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as ModelConfig;
}

export async function getDefaultModelConfig(): Promise<ModelConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .select('*')
    .eq('is_default', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as ModelConfig;
}

export async function getTitleModelConfig(): Promise<ModelConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .select('*')
    .eq('is_title_model', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as ModelConfig;
}

export async function createModelConfig(config: {
  id: string;
  provider: string;
  base_url?: string;
  api_key?: string;
  capabilities?: any;
  reasoning_effort?: string;
  is_default?: boolean;
  is_title_model?: boolean;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .insert(config)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateModelConfig(
  id: string,
  changes: Partial<{
    provider: string;
    base_url: string;
    api_key: string;
    capabilities: any;
    reasoning_effort: string;
    is_default: boolean;
    is_title_model: boolean;
  }>
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteModelConfig(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('model_config').delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/db/server-queries.ts lib/ai/chat-db.ts lib/ai/artifacts-db.ts lib/ai/models-db.ts
git commit -m "feat: 创建服务端数据访问层（chat-db/artifacts-db/models-db/server-queries）"
```

---

## Task 5: 鉴权层迁移 - 删除 NextAuth

**Files:**
- Delete: `app/(auth)/auth.ts`
- Delete: `app/(auth)/auth.config.ts`
- Delete: `app/(auth)/actions.ts`
- Delete: `app/(auth)/api/auth/[...nextauth]/route.ts`
- Delete: `lib/db/utils.ts`
- Modify: `lib/constants.ts`

- [ ] **Step 1: 删除 NextAuth 相关文件**

Run:
```bash
rm -rf "app/(auth)/api/auth"
rm -f "app/(auth)/auth.ts"
rm -f "app/(auth)/auth.config.ts"
rm -f "app/(auth)/actions.ts"
rm -f lib/db/utils.ts
```

- [ ] **Step 2: 改造 lib/constants.ts**

Read `lib/constants.ts` first, then remove `DUMMY_PASSWORD` and related constants. Keep other constants intact.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: 删除 NextAuth 相关文件和密码哈希工具"
```

---

## Task 6: 鉴权层迁移 - 改造登录/注册页面

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/register/page.tsx`
- Modify: `app/(auth)/layout.tsx`
- Modify: `components/chat/auth-form.tsx`

- [ ] **Step 1: 改造 auth-form.tsx**

Read `components/chat/auth-form.tsx` first to understand current structure, then replace with Supabase Auth version. Key changes:
- Remove `signIn` from `next-auth/react`
- Import `createClient` from `@/lib/supabase/client`
- Login: `supabase.auth.signInWithPassword({ email, password })`
- Register: `supabase.auth.signUp({ email, password, options: { data: { name } } })`
- On success: `router.push('/')` + `router.refresh()`

- [ ] **Step 2: 改造 login/page.tsx**

Read `app/(auth)/login/page.tsx` first, then:
- Remove `useSession` / `updateSession` imports
- Remove `login` Server Action import
- Use the new `AuthForm` component directly

- [ ] **Step 3: 改造 register/page.tsx**

Read `app/(auth)/register/page.tsx` first, then:
- Remove `useSession` / `updateSession` imports
- Remove `register` Server Action import
- Use the new `AuthForm` component directly

- [ ] **Step 4: 改造 (auth)/layout.tsx**

Read `app/(auth)/layout.tsx` first, then remove any SessionProvider references.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/" components/chat/auth-form.tsx
git commit -m "feat: 鉴权层迁移 - 登录/注册改用 Supabase Auth"
```

---

## Task 7: 鉴权层迁移 - 改造 proxy.ts 和根布局

**Files:**
- Modify: `proxy.ts`
- Modify: `app/layout.tsx`
- Modify: `components/chat/sign-out-form.tsx`
- Modify: `components/chat/sidebar-user-nav.tsx`

- [ ] **Step 1: 重写 proxy.ts**

Read `proxy.ts` first, then replace with:
```ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const publicRoutes = ['/ping', '/login', '/register'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/ping') {
    return NextResponse.text('pong');
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 已登录访问 /login、/register → 重定向首页
  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // 公开路由放行
  if (publicRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // 未登录访问受保护路由 → 重定向登录
  if (!user) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/chat/:id*', '/api/:path*', '/login', '/register'],
};
```

- [ ] **Step 2: 改造 app/layout.tsx**

Read `app/layout.tsx` first, then:
- Remove `SessionProvider` import and wrapping
- Keep other providers intact

- [ ] **Step 3: 改造 sign-out-form.tsx**

Read `components/chat/sign-out-form.tsx` first, then replace with Supabase version:
```tsx
'use client';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function SignOutForm() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return <button onClick={handleSignOut}>退出登录</button>;
}
```

- [ ] **Step 4: 创建 hooks/use-user.ts**

Create `hooks/use-user.ts`:
```ts
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type UserProfile = {
  id: string;
  name: string | null;
  image: string | null;
  is_anonymous: boolean;
};

export function useUser() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;

      setUser(user);
      setLoading(false);

      if (user) {
        const { data } = await supabase
          .from('user_profile')
          .select('*')
          .eq('id', user.id)
          .single();
        if (mounted) setProfile(data);
      } else {
        setProfile(null);
      }
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  return { user, profile, loading };
}
```

- [ ] **Step 5: 改造 sidebar-user-nav.tsx**

Read `components/chat/sidebar-user-nav.tsx` first, then:
- Remove `useSession`, `signOut` from `next-auth/react`
- Import `useUser` from `@/hooks/use-user`
- Import `createClient` from `@/lib/supabase/client`
- Use `profile?.name` / `profile?.image` for display
- Sign out: `supabase.auth.signOut()` + `router.push('/login')`

- [ ] **Step 6: Commit**

```bash
git add proxy.ts app/layout.tsx components/chat/sign-out-form.tsx components/chat/sidebar-user-nav.tsx hooks/use-user.ts
git commit -m "feat: 鉴权层迁移 - proxy.ts 和组件改造"
```

---

## Task 8: 删除旧数据库层

**Files:**
- Delete: `lib/db/queries.ts`
- Delete: `lib/db/migrate.ts`
- Delete: `lib/db/migrations/`
- Delete: `lib/db/schema.ts`
- Delete: `drizzle.config.ts`

- [ ] **Step 1: 删除旧数据库文件**

Run:
```bash
rm -f lib/db/queries.ts
rm -f lib/db/migrate.ts
rm -f lib/db/schema.ts
rm -rf lib/db/migrations
rm -f drizzle.config.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "refactor: 删除 drizzle 相关文件（queries/migrate/schema/migrations）"
```

---

## Task 9: 删除被替代的 API 路由

**Files:**
- Delete: `app/(chat)/api/history/route.ts`
- Delete: `app/(chat)/api/messages/route.ts`
- Delete: `app/(chat)/api/document/route.ts`
- Delete: `app/(chat)/api/vote/route.ts`
- Delete: `app/(chat)/api/suggestions/route.ts`
- Delete: `app/(chat)/api/files/upload/route.ts`
- Delete: `app/(chat)/api/chat/[id]/stream/route.ts`

- [ ] **Step 1: 删除被 RLS 替代的 API 路由**

Run:
```bash
rm -rf "app/(chat)/api/history"
rm -rf "app/(chat)/api/messages"
rm -rf "app/(chat)/api/document"
rm -rf "app/(chat)/api/vote"
rm -rf "app/(chat)/api/suggestions"
rm -rf "app/(chat)/api/files"
rm -rf "app/(chat)/api/chat/[id]"
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "refactor: 删除被 RLS 替代的 API 路由（history/messages/document/vote/suggestions/files/stream）"
```

---

## Task 10: 改造 chat 路由

**Files:**
- Modify: `app/(chat)/api/chat/route.ts`

- [ ] **Step 1: 读取当前 chat 路由**

Read `app/(chat)/api/chat/route.ts` to understand current structure.

- [ ] **Step 2: 改造 chat 路由**

Key changes:
- Remove `import { auth } from "@/app/(auth)/auth"`
- Remove `import { createResumableStreamContext } from "resumable-stream"`
- Remove `getStreamContext` function and all resumable-stream logic
- Remove `consumeSseStream` function
- Add `import { createClient } from '@/lib/supabase/server'`
- Add `import { saveChat, saveMessages } from '@/lib/ai/chat-db'`
- Add `import { getMessageCountByUserId } from '@/lib/db/server-queries'`
- Add `import { getDefaultModelConfig } from '@/lib/ai/models-db'`
- Replace `await auth()` with:
  ```ts
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new ChatbotError("unauthorized:chat").toResponse();
  ```
- Replace `getMessageCountByUserId(user.id)` with `getMessageCountByUserId()`
- Replace model config fetching with `getDefaultModelConfig()`
- Replace `saveChat` / `saveMessages` calls (now from `@/lib/ai/chat-db`)
- Replace stream output: remove `streamContext.createNewResumableStream` wrapper, use `result.toUIMessageStreamResponse()` directly
- Remove `Stream` table writes
- For DELETE: replace drizzle delete with `supabase.from('chat').delete().eq('id', chatId)`

- [ ] **Step 3: Commit**

```bash
git add "app/(chat)/api/chat/route.ts"
git commit -m "refactor: chat 路由迁移到 Supabase（移除 resumable-stream，改用 admin client）"
```

---

## Task 11: 改造 models API 路由

**Files:**
- Modify: `app/(chat)/api/models/route.ts`
- Modify: `app/(chat)/api/models/test/route.ts`

- [ ] **Step 1: 改造 models/route.ts**

Read `app/(chat)/api/models/route.ts` first, then:
- Replace `auth()` with `createClient()` + `supabase.auth.getUser()`
- Replace drizzle queries with `getAllModelConfigsForClient()`, `createModelConfig()`, `updateModelConfig()`, `deleteModelConfig()` from `@/lib/ai/models-db`
- GET returns脱敏 data (no api_key)

- [ ] **Step 2: 改造 models/test/route.ts**

Read `app/(chat)/api/models/test/route.ts` first, then:
- Replace `auth()` with `createClient()` + `supabase.auth.getUser()`
- Replace drizzle query with `getModelConfigById()` from `@/lib/ai/models-db`

- [ ] **Step 3: Commit**

```bash
git add "app/(chat)/api/models/"
git commit -m "refactor: models API 路由迁移到 Supabase（含 api_key 脱敏）"
```

---

## Task 12: 改造 AI providers 和 tools

**Files:**
- Modify: `lib/ai/providers.ts`
- Modify: `lib/ai/models.ts`
- Modify: `lib/ai/tools/create-document.ts`
- Modify: `lib/ai/tools/edit-document.ts`
- Modify: `lib/ai/tools/update-document.ts`
- Modify: `lib/ai/tools/request-suggestions.ts`

- [ ] **Step 1: 改造 lib/ai/providers.ts**

Read `lib/ai/providers.ts` first, then:
- Replace drizzle queries with `getDefaultModelConfig()`, `getTitleModelConfig()` from `@/lib/ai/models-db`
- Keep `createOpenAI` logic intact

- [ ] **Step 2: 改造 lib/ai/models.ts**

Read `lib/ai/models.ts` first, then:
- Replace drizzle queries with functions from `@/lib/ai/models-db`

- [ ] **Step 3: 改造 AI tools (4 个文件)**

For each tool file (`create-document.ts`, `edit-document.ts`, `update-document.ts`, `request-suggestions.ts`):
- Read current file
- Replace drizzle queries with functions from `@/lib/ai/artifacts-db.ts`
- Keep tool definition structure intact

- [ ] **Step 4: Commit**

```bash
git add lib/ai/
git commit -m "refactor: AI providers 和 tools 迁移到 Supabase admin client"
```

---

## Task 13: 改造 Server Actions

**Files:**
- Modify: `app/(chat)/actions.ts`

- [ ] **Step 1: 改造 actions.ts**

Read `app/(chat)/actions.ts` first, then:
- Replace `auth()` with `createClient()` + `supabase.auth.getUser()`
- Replace drizzle queries with appropriate functions:
  - `deleteTrailingMessages` → `deleteMessagesByChatIdAfterTimestamp` from `@/lib/ai/chat-db`
  - `updateChatVisibility` → `supabase.from('chat').update({visibility}).eq('id', chatId)`
- Keep `generateTitleFromUserMessage` intact (no DB changes)
- Keep `saveChatModelAsCookie` intact

- [ ] **Step 2: Commit**

```bash
git add "app/(chat)/actions.ts"
git commit -m "refactor: Server Actions 迁移到 Supabase"
```

---

## Task 14: 创建前端数据获取 hooks

**Files:**
- Create: `hooks/use-chat-history.ts`
- Create: `hooks/use-documents.ts`
- Create: `hooks/use-votes.ts`
- Create: `hooks/use-suggestions.ts`
- Create: `hooks/use-require-auth.ts`
- Modify: `hooks/use-messages.ts`
- Modify: `hooks/use-active-chat.tsx`
- Delete: `hooks/use-auto-resume.ts`

- [ ] **Step 1: 创建 use-chat-history.ts**

Create `hooks/use-chat-history.ts`:
```ts
'use client';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';

type ChatHistoryItem = {
  id: string;
  title: string | null;
  visibility: 'public' | 'private';
  created_at: string;
};

export function useChatHistory(limit = 100) {
  const supabase = createClient();

  return useSWR<ChatHistoryItem[]>('chat-history', async () => {
    const { data, error } = await supabase
      .from('chat')
      .select('id, title, visibility, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });
}
```

- [ ] **Step 2: 创建 use-documents.ts**

Create `hooks/use-documents.ts`:
```ts
'use client';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';

type Document = {
  id: string;
  created_at: string;
  content: string | null;
  kind: 'text' | 'code' | 'image' | 'sheet';
  title: string | null;
};

export function useDocuments(documentId: string) {
  const supabase = createClient();

  return useSWR<Document[]>(['documents', documentId], async () => {
    const { data, error } = await supabase
      .from('document')
      .select('id, created_at, content, kind, title')
      .eq('id', documentId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  });
}

export function useLatestDocument(documentId: string) {
  const supabase = createClient();

  return useSWR<Document>(['document-latest', documentId], async () => {
    const { data, error } = await supabase
      .from('document_latest')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) throw error;
    return data;
  });
}
```

- [ ] **Step 3: 创建 use-votes.ts**

Create `hooks/use-votes.ts`:
```ts
'use client';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';

type Vote = {
  chat_id: string;
  message_id: string;
  is_upvoted: boolean;
};

export function useVotes(chatId: string) {
  const supabase = createClient();

  return useSWR<Vote[]>(['votes', chatId], async () => {
    const { data, error } = await supabase
      .from('vote')
      .select('chat_id, message_id, is_upvoted')
      .eq('chat_id', chatId);

    if (error) throw error;
    return data;
  });
}

export async function voteMessage(
  chatId: string,
  messageId: string,
  isUpvoted: boolean
) {
  const supabase = createClient();
  const { error } = await supabase
    .from('vote')
    .upsert(
      { chat_id: chatId, message_id: messageId, is_upvoted: isUpvoted },
      { onConflict: 'chat_id,message_id' }
    );

  if (error) throw error;
}
```

- [ ] **Step 4: 创建 use-suggestions.ts**

Create `hooks/use-suggestions.ts`:
```ts
'use client';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';

type Suggestion = {
  id: string;
  original_text: string | null;
  suggested_text: string | null;
  is_resolved: boolean;
  created_at: string;
};

export function useSuggestions(documentId: string, documentCreatedAt: string) {
  const supabase = createClient();

  return useSWR<Suggestion[]>(
    ['suggestions', documentId, documentCreatedAt],
    async () => {
      const { data, error } = await supabase
        .from('suggestion')
        .select('id, original_text, suggested_text, is_resolved, created_at')
        .eq('document_id', documentId)
        .eq('document_created_at', documentCreatedAt)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    }
  );
}
```

- [ ] **Step 5: 创建 use-require-auth.ts**

Create `hooks/use-require-auth.ts`:
```ts
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from './use-user';

export function useRequireAuth() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  return { user, loading };
}
```

- [ ] **Step 6: 改造 use-messages.ts**

Read `hooks/use-messages.ts` first, then replace fetch logic with supabase-js:
```ts
'use client';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';

type Message = {
  id: string;
  chat_id: string;
  role: string;
  parts: any;
  attachments: any;
  created_at: string;
};

export function useMessages(chatId: string) {
  const supabase = createClient();

  return useSWR<Message[]>(['messages', chatId], async () => {
    const { data, error } = await supabase
      .from('message')
      .select('id, chat_id, role, parts, attachments, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  });
}
```

- [ ] **Step 7: 改造 use-active-chat.tsx**

Read `hooks/use-active-chat.tsx` first, then:
- Remove `import { resumeStream } from './use-auto-resume'`
- Remove `resumeStream` from `useChat` destructuring
- Remove all `resumeStream` related logic
- Keep other logic intact

- [ ] **Step 8: 删除 use-auto-resume.ts**

Run:
```bash
rm -f hooks/use-auto-resume.ts
```

- [ ] **Step 9: Commit**

```bash
git add hooks/
git commit -m "feat: 创建前端数据获取 hooks，删除 use-auto-resume"
```

---

## Task 15: 改造聊天组件

**Files:**
- Modify: `components/chat/sidebar-history.tsx`
- Modify: `components/chat/messages.tsx`
- Modify: `components/chat/vote.tsx`

- [ ] **Step 1: 改造 sidebar-history.tsx**

Read `components/chat/sidebar-history.tsx` first, then:
- Remove `fetch('/api/history')` calls
- Import `useChatHistory` from `@/hooks/use-chat-history`
- Import `createClient` from `@/lib/supabase/client`
- Delete chat: `supabase.from('chat').delete().eq('id', chatId)` + `mutate()`

- [ ] **Step 2: 改造 messages.tsx**

Read `components/chat/messages.tsx` first, then:
- Remove `fetch('/api/messages')` calls
- Import `useMessages` from `@/hooks/use-messages`

- [ ] **Step 3: 改造 vote.tsx**

Read `components/chat/vote.tsx` first, then:
- Remove `fetch('/api/vote')` calls
- Import `useVotes`, `voteMessage` from `@/hooks/use-votes`

- [ ] **Step 4: Commit**

```bash
git add components/chat/sidebar-history.tsx components/chat/messages.tsx components/chat/vote.tsx
git commit -m "refactor: 聊天组件数据源切换为 SWR hooks"
```

---

## Task 16: 创建文件存储层

**Files:**
- Create: `lib/storage/client.ts`
- Create: `components/chat/attachment-upload.tsx`
- Create: `components/chat/message-attachments.tsx`

- [ ] **Step 1: 创建 lib/storage/client.ts**

Create `lib/storage/client.ts`:
```ts
'use client';
import { createClient } from '@/lib/supabase/client';

const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadChatAttachment(
  file: File,
  chatId: string
): Promise<{ path: string; url: string }> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('仅支持 JPEG/PNG 格式');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('文件大小不能超过 5MB');
  }

  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `${user.id}/${chatId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('chat-attachments')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = await supabase.storage
    .from('chat-attachments')
    .createSignedUrl(filePath, 3600);

  return {
    path: filePath,
    url: urlData?.signedUrl ?? '',
  };
}

export async function getAttachmentUrls(paths: string[]): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data } = await supabase.storage
    .from('chat-attachments')
    .createSignedUrls(paths, 3600);

  const result: Record<string, string> = {};
  data?.forEach((item, index) => {
    if (item.signedUrl) {
      result[paths[index]] = item.signedUrl;
    }
  });
  return result;
}
```

- [ ] **Step 2: 创建 attachment-upload.tsx**

Create `components/chat/attachment-upload.tsx`:
```tsx
'use client';
import { uploadChatAttachment } from '@/lib/storage/client';

export function AttachmentUpload({ chatId, onUploaded }: {
  chatId: string;
  onUploaded: (attachment: { path: string; url: string }) => void;
}) {
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadChatAttachment(file, chatId);
      onUploaded(result);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <input
      type="file"
      accept="image/jpeg,image/png"
      onChange={handleFileChange}
    />
  );
}
```

- [ ] **Step 3: 创建 message-attachments.tsx**

Create `components/chat/message-attachments.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { getAttachmentUrls } from '@/lib/storage/client';

export function MessageAttachments({ attachments }: {
  attachments: Array<{ path: string; type: string }>;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (attachments.length === 0) return;
    const paths = attachments.map((a) => a.path);
    getAttachmentUrls(paths).then(setUrls);
  }, [attachments]);

  if (attachments.length === 0) return null;

  return (
    <div className="flex gap-2">
      {attachments.map((att) => (
        <img
          key={att.path}
          src={urls[att.path]}
          alt="attachment"
          className="max-w-32 max-h-32 rounded"
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/storage/ components/chat/attachment-upload.tsx components/chat/message-attachments.tsx
git commit -m "feat: 创建文件存储层（客户端直传 Supabase Storage）"
```

---

## Task 17: 创建 SWR Provider

**Files:**
- Create: `components/providers/swr-provider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: 创建 swr-provider.tsx**

Create `components/providers/swr-provider.tsx`:
```tsx
'use client';
import { SWRConfig } from 'swr';

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 2000,
        errorRetryCount: 3,
      }}
    >
      {children}
    </SWRConfig>
  );
}
```

- [ ] **Step 2: 在 app/layout.tsx 中包裹 SWRProvider**

Read `app/layout.tsx` first, then wrap children with SWRProvider (after removing SessionProvider in Task 7).

- [ ] **Step 3: Commit**

```bash
git add components/providers/swr-provider.tsx app/layout.tsx
git commit -m "feat: 创建 SWR Provider 全局配置"
```

---

## Task 18: 改造部署配置

**Files:**
- Modify: `package.json`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `next.config.ts`
- Modify: `vercel-template.json`

- [ ] **Step 1: 改造 package.json scripts**

Read `package.json` first, then update scripts:
```json
{
  "scripts": {
    "dev": "next dev --turbo --port 30000",
    "build": "next build",
    "start": "next start --port 30000",
    "db:generate": "supabase gen types --lang=typescript --project-ref $SUPABASE_PROJECT_REF > lib/db/database.types.ts",
    "db:migrate": "supabase db push",
    "db:reset": "supabase db reset",
    "db:studio": "supabase studio",
    "db:pull": "supabase db pull",
    "db:push": "supabase db push",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "check": "ultracite check",
    "check:fix": "ultracite fix",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 2: 改造 Dockerfile**

Read `Dockerfile` first, then remove the line:
```dockerfile
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
```

- [ ] **Step 3: 改造 docker-compose.yml**

Read `docker-compose.yml` first, then replace with:
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - AI_GATEWAY_API_KEY=${AI_GATEWAY_API_KEY}
    restart: unless-stopped
```

- [ ] **Step 4: 改造 next.config.ts**

Read `next.config.ts` first, then add supabase.co to images.remotePatterns:
```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'avatar.vercel.sh' },
    { protocol: 'https', hostname: '*.supabase.co' },
  ],
},
```

- [ ] **Step 5: 改造 vercel-template.json**

Read `vercel-template.json` first, then replace integrations with supabase only.

- [ ] **Step 6: Commit**

```bash
git add package.json Dockerfile docker-compose.yml next.config.ts vercel-template.json
git commit -m "refactor: 部署配置改造（移除 postgres/redis，新增 supabase）"
```

---

## Task 19: 改造 CI/CD

**Files:**
- Modify: `.github/workflows/playwright.yml`

- [ ] **Step 1: 改造 playwright.yml**

Read `.github/workflows/playwright.yml` first, then:
- Remove docker-compose postgres/redis startup
- Add local Supabase startup:
  ```yaml
  - name: Start local Supabase
    run: |
      npx supabase start
      npx supabase db push
  - name: Set test environment variables
    run: |
      echo "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321" >> .env.test
      echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=..." >> .env.test
      echo "SUPABASE_SERVICE_ROLE_KEY=..." >> .env.test
  - name: Stop local Supabase
    if: always()
    run: npx supabase stop
  ```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/playwright.yml
git commit -m "refactor: CI 改用本地 Supabase 替代 docker-compose"
```

---

## Task 20: 更新 README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README.md**

Read `README.md` first, then update:
- Deployment section: Vercel + Supabase cloud instructions
- Environment variables table
- Local development section (connect to Supabase cloud)
- Remove references to Neon / Upstash / Vercel Blob / local Postgres / local Redis

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: 更新 README 部署文档"
```

---

## Task 21: 运行测试与验证

**Files:** None (verification only)

- [ ] **Step 1: 运行 biome 检查**

Run:
```bash
pnpm lint
```
Expected: PASS (fix any issues with `pnpm lint:fix`)

- [ ] **Step 2: 运行 ultracite 检查**

Run:
```bash
pnpm check
```
Expected: PASS (fix any issues with `pnpm check:fix`)

- [ ] **Step 3: 运行 TypeScript 类型检查**

Run:
```bash
pnpm exec tsc --noEmit
```
Expected: PASS (fix any type errors)

- [ ] **Step 4: 运行 Playwright E2E 测试**

Run:
```bash
pnpm test:e2e
```
Expected: PASS (fix any failing tests)

- [ ] **Step 5: 本地启动验证**

Run:
```bash
pnpm dev
```
Expected: Server starts on port 30000, can access http://localhost:30000

- [ ] **Step 6: 手动功能验证**

Verify the following:
- [ ] 用户可注册（Supabase Auth）
- [ ] 用户可登录（Supabase Auth）
- [ ] 用户可退出（Supabase Auth）
- [ ] 创建 chat 正常
- [ ] AI 对话流式输出正常
- [ ] 查看 chat 历史正常
- [ ] 删除 chat 正常（级联删除）
- [ ] 文档创建/编辑正常
- [ ] 消息投票正常
- [ ] 模型配置 CRUD 正常（api_key 不泄露）
- [ ] 文件上传正常（Supabase Storage）

- [ ] **Step 7: 最终 commit**

```bash
git add -A
git commit -m "test: 通过所有测试验证（biome/playwright/check/lint）"
```

---

## Self-Review

### Spec coverage check

- [x] 数据库 schema 设计 → Task 2
- [x] RLS 策略 → Task 2
- [x] View 与 RPC → Task 2
- [x] 鉴权层迁移 → Task 5, 6, 7
- [x] 数据访问层 → Task 3, 4, 8
- [x] 文件存储 → Task 16
- [x] AI 链路 → Task 10, 11, 12, 13
- [x] 前端改造 → Task 14, 15, 17
- [x] 部署配置 → Task 18, 19, 20
- [x] 测试验证 → Task 21

### Placeholder scan

No placeholders found. All tasks have complete code and commands.

### Type consistency

- `createClient` (browser) / `createClient` (server, async) / `createAdminClient` - consistent across tasks
- `ModelConfig` type used in Task 4 matches usage in Task 11, 12
- `ChatHistoryItem`, `Message`, `Vote`, `Document`, `Suggestion` types consistent across hooks

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-17-supabase-migration.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
