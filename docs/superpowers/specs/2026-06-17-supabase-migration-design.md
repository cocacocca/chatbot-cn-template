# 设计文档：chatbot-cn-template 接入 Supabase 完全替代方案

## 1. 核心结论（一句话）

将 chatbot-cn-template 的数据库（drizzle+Postgres）、鉴权（NextAuth）、文件存储（本地磁盘）**完全替换为 Supabase 全家桶**（Postgres + Auth + Storage），全面启用 RLS 替代应用层鉴权，放弃 Redis 断线续传，部署到 Vercel + Supabase 云。

---

## 2. 背景与目标

### 2.1 情境（Situation）

- 项目是 Next.js 16.2.0 App Router 的 AI ChatBot 模板（chatbot-cn-template v3.1.0）
- 当前技术栈：drizzle-orm + postgres-js（数据库）、NextAuth v5 beta（鉴权）、本地磁盘（文件存储）、redis + resumable-stream（断线续传，未实际启用）
- 部署方式：Vercel（首选）+ Docker 自建双轨
- 项目无 Supabase 痕迹

### 2.2 冲突（Complication）

1. **本地磁盘存储生产不可靠**：Vercel Serverless 文件系统只读，`./uploads` 方案跑不起来，且缺 GET 路由
2. **NextAuth v5 仍是 beta**：Credentials Provider 仅支持邮箱密码，无 OAuth/Magic Link，需自管 bcrypt 哈希
3. **drizzle + 应用层鉴权模式未发挥 Postgres 优势**：无 RLS、无事务、级联删除靠顺序 SQL
4. **Redis 依赖实际未启用**：resumable-stream 的恢复端点是 stub（返回 204），Redis 依赖是"死代码"
5. **Upstash Redis 在 Vercel Serverless 下有硬伤**：REST API 不支持 pub/sub，TCP 端点有连接数/超时问题

### 2.3 目标

- 数据库 + 鉴权 + 存储**完全迁移到 Supabase**
- 移除 drizzle-orm、next-auth、bcrypt-ts、redis、resumable-stream 等依赖
- 全面启用 RLS，替代应用层所有权校验
- 放弃断线续传（移除 Redis 依赖）
- 部署到 Vercel + Supabase 云（均 Free tier）
- 不提供数据迁移路径（重新开始）

---

## 3. 决策汇总

| 决策点 | 选择 | 理由 |
|---|---|---|
| drizzle 去留 | **完全移除**，改用 supabase-js + PostgREST | 发挥 RLS 价值，模板项目示范 Supabase 最佳实践 |
| RLS 策略 | **全面启用**，替代应用层鉴权 | 鉴权与数据访问在数据库层统一，客户端可直查 |
| Redis/断线续传 | **放弃**，移除 redis + resumable-stream + Stream 表 | Upstash REST 不兼容 pub/sub，TCP 端点 Serverless 有硬伤，当前恢复端点是 stub |
| 部署 | Vercel + Supabase 云（均 Free tier） | 用户已有两个云服务账号 |
| 数据迁移 | 不提供，重新开始 | 模板项目，无生产数据 |
| 本地开发 | 先连云 Supabase | 用户明确选择 |

---

## 4. 方案设计

### 4.1 架构概述

**改造前**：
```
[Client] → fetch → [Next.js API Routes (11个)] → [drizzle-orm] → [Postgres]
                        ↓ auth()
                   [NextAuth v5 + bcrypt-ts] → [User 表]
                        ↓
                   [本地磁盘 ./uploads]
                        ↓
                   [Redis]（resumable-stream，未实际启用）
```

**改造后**：
```
[Client] ──┬── supabase-js (anon key + RLS) ──→ [Supabase Postgres] ← RLS Policies
           │                                          ↑
           ├── supabase-js (auth) ─────────────→ [Supabase Auth]
           │
           ├── supabase-js (storage) ──────────→ [Supabase Storage]
           │
           └── fetch → [Next.js API Routes (5个)] → [supabase-js (service_role)]
                         │  ① chat（AI 流式，60s 长连接）
                         │  ② models（model_config CRUD，脱敏 api_key）
                         │  ③ models/test（LLM 连通性测试）
                         ↓
                    [AI SDK + ModelConfig 表]
```

### 4.2 核心组件

#### 4.2.1 三个 Supabase 客户端

| 客户端 | 位置 | 用途 | Key |
|---|---|---|---|
| browser | `lib/supabase/client.ts` | 客户端组件，RLS 范围 | anon |
| server | `lib/supabase/server.ts` | Server Component / Route Handler，RLS 范围 | anon |
| admin | `lib/supabase/admin.ts` | 服务端特权操作（绕过 RLS） | service_role |

#### 4.2.2 API 路由去留

| 路由 | 操作 | 理由 |
|---|---|---|
| `chat` | 保留改造 | AI 流式 + 60s 长连接，无法用 RLS 替代 |
| `models` | 保留改造 | apiKey 敏感字段，需 service_role + 脱敏 |
| `models/test` | 保留改造 | LLM 连通性测试，服务端逻辑 |
| `files/upload` | **删除** | 改客户端直传 Storage |
| `history` | **删除** | RLS 替代，客户端直查 |
| `messages` | **删除** | RLS 替代，客户端直查 |
| `document` | **删除** | RLS 替代，客户端直查 |
| `vote` | **删除** | RLS 替代，客户端直查 |
| `suggestions` | **删除** | RLS 替代，客户端直查 |
| `chat/[id]/stream` | **删除** | 放弃断线续传 |

**结果**：11 个 → 5 个保留（chat / models / models-test + 删除 stream）

### 4.3 数据流

#### 4.3.1 客户端直查模式（RLS 保证安全）

```
[Client Component]
  → useSWR(key, fetcher)
  → fetcher: supabase.from('chat').select().eq(...)
  → RLS policy 自动校验 auth.uid() = user_id
  → 返回数据
```

#### 4.3.2 服务端特权模式（AI 链路）

```
[chat API Route]
  → supabase.auth.getUser() 鉴权
  → createAdminClient() 获取特权客户端
  → saveChat / saveMessages（绕过 RLS）
  → streamText 生成 AI 回复
  → result.toUIMessageStreamResponse() 直接返回流
```

#### 4.3.3 文件上传模式（客户端直传）

```
[Client]
  → supabase.storage.from('chat-attachments').upload(path, file)
  → RLS 校验路径前缀 (storage.foldername(name)[1] = auth.uid())
  → createSignedUrl 获取临时访问 URL
  → 将 path 存入 message.attachments
```

### 4.4 错误处理

- **RLS 拒绝访问**：supabase-js 返回 `error`，前端 SWR 捕获后 toast 提示
- **service_role 调用失败**：抛出 `ChatbotError`，API 路由返回对应错误码
- **Storage 上传失败**：客户端捕获，toast 提示，不阻塞消息发送
- **Auth 失败**：`onAuthStateChange` 监听，自动跳转登录页

---

## 5. 数据库 Schema 设计

### 5.1 表结构变更

| 表 | 改造前 | 改造后 | 变化 |
|---|---|---|---|
| User | 自建，含 password/email | 拆为 `auth.users` + `user_profile` | 移除 password/email/emailVerified |
| Chat | 不变 | 不变 | — |
| Message_v2 | 不变 | 重命名为 `message` | snake_case 命名 |
| Vote_v2 | 复合主键 | 复合主键 | 重命名为 `vote` |
| Document | 复合主键 | 复合主键 | — |
| Suggestion | 复合外键 | 复合外键 | — |
| Stream | 存在 | **删除** | 放弃断线续传 |
| ModelConfig | 全局配置 | 全局配置 | 重命名为 `model_config`，snake_case |

### 5.2 关键设计：用户表双表关联

```
auth.users（Supabase 内置）
  ├─ id (uuid)
  ├─ email
  ├─ encrypted_password
  └─ email_confirmed_at

public.user_profile（业务用户表）
  ├─ id (uuid) → REFERENCES auth.users(id) ON DELETE CASCADE
  ├─ name, image, is_anonymous
  └─ created_at, updated_at
```

- 移除 `password`：Supabase Auth 内置 bcrypt
- 移除 `email`：从 `auth.users` 关联查
- 触发器 `handle_new_user` 自动同步：注册时在 `user_profile` 创建对应记录

### 5.3 RLS 策略

- **user_profile**：`auth.uid() = id`（用户只能操作自己的 profile）
- **chat**：`auth.uid() = user_id OR visibility = 'public'`（支持公开 chat）
- **message**：通过 `exists` 子查询关联 chat 校验所有权
- **vote**：通过 chat 关联校验
- **document**：`auth.uid() = user_id`
- **suggestion**：`auth.uid() = user_id`
- **model_config**：**不启用 RLS**，仅 service_role 访问（含 api_key 敏感字段）

### 5.4 View 与 RPC

- **`document_latest` View**：`select distinct on (id) * from document order by id, created_at desc`，简化复合主键表的"查最新版本"查询
- **`get_message_count_by_user_id` RPC**：`SECURITY DEFINER`，替代 innerJoin 查询（用于限流）

### 5.5 外键级联

所有外键声明 `ON DELETE CASCADE`，替代当前无事务的顺序 SQL 删除：
- 删除 chat → 自动删除 message / vote / document / suggestion
- 删除 user → 自动删除 user_profile / chat / document / suggestion

---

## 6. 鉴权层设计

### 6.1 架构对比

**改造前**（NextAuth v5）：
- Credentials Provider + bcrypt-ts
- JWT 模式（AUTH_SECRET 签名）
- Cookie: `next-auth.session-token`
- `proxy.ts` 用 `getToken()` 校验

**改造后**（Supabase Auth）：
- `supabase.auth.signInWithPassword()` / `signUp()`
- JWT（Supabase 签名）
- Cookie: `sb-xxx-auth-token`（`@supabase/ssr` 自动管理）
- `proxy.ts` 用 `supabase.auth.getUser()` 校验

### 6.2 登录/注册流程

- **登录**：客户端直接调用 `supabase.auth.signInWithPassword({ email, password })`
- **注册**：客户端直接调用 `supabase.auth.signUp({ email, password, options: { data: { name } } })`
- **退出**：客户端调用 `supabase.auth.signOut()`
- **不再走 Server Action**，减少一跳

### 6.3 用户状态获取

- **客户端**：`useUser` 自定义 hook（封装 `getUser` + `onAuthStateChange` 订阅 + user_profile 查询）
- **Server Component**：`await createClient()` → `supabase.auth.getUser()` + `from('user_profile').select()`

### 6.4 文件改造清单

| 文件 | 操作 |
|---|---|
| `app/(auth)/auth.ts` / `auth.config.ts` / `actions.ts` | **删除** |
| `app/(auth)/api/auth/[...nextauth]/` | **删除**（整个目录） |
| `app/(auth)/login/page.tsx` / `register/page.tsx` | 改造（客户端直接调用 Supabase Auth） |
| `app/layout.tsx` | 改造（移除 SessionProvider） |
| `proxy.ts` | 重写（NextAuth getToken → Supabase getUser） |
| `components/chat/auth-form.tsx` / `sign-out-form.tsx` / `sidebar-user-nav.tsx` | 改造 |
| `lib/db/utils.ts` | **删除**（generateHashedPassword 不再需要） |
| `lib/constants.ts` | 改造（移除 DUMMY_PASSWORD） |
| `hooks/use-user.ts` | **新增** |
| `lib/supabase/client.ts` / `server.ts` / `admin.ts` | **新增** |

---

## 7. 数据访问层设计

### 7.1 queries.ts 函数去向

当前 30 个函数按改造后去向分组：

#### A. 删除（改客户端直查，RLS 保证安全）— 18 个

getUser / createUser / updateUser / deleteUser / getChatsByUserId / getChatById / deleteChatById / deleteAllChatsByUserId / updateChatVisibilityById / updateChatTitleById / getMessagesByChatId / getMessageById / updateMessage / deleteMessagesByChatIdAfterTimestamp / getVotesByChatId / getDocumentsById / getDocumentById / deleteDocumentsByIdAfterTimestamp / getSuggestionsByDocumentId

#### B. 保留并改造（服务端特权操作）— 8 个

| 函数 | 改造后位置 |
|---|---|
| saveChat / saveMessages / deleteMessagesByChatIdAfterTimestamp | `lib/ai/chat-db.ts` |
| voteMessage / getMessageCountByUserId | `lib/db/server-queries.ts` |
| saveDocument / updateDocumentContent / saveSuggestions | `lib/ai/artifacts-db.ts` |
| getAllModelConfigs / getModelConfigById / getDefaultModelConfig / getTitleModelConfig / createModelConfig / updateModelConfig / deleteModelConfig | `lib/ai/models-db.ts`（含脱敏逻辑） |

#### C. 删除（功能移除）— 4 个

createStreamId / getStreamIdsByChatId / generateHashedPassword / generateDummyPassword

### 7.2 改造后文件结构

```
lib/
├── supabase/
│   ├── client.ts          # 浏览器客户端（anon + RLS）
│   ├── server.ts          # 服务端客户端（anon + RLS）
│   ├── admin.ts           # 特权客户端（service_role）
│   └── types.ts           # 统一导出 Database 类型
├── db/
│   ├── database.types.ts  # supabase gen types 生成
│   └── server-queries.ts  # 服务端特权查询
├── ai/
│   ├── chat-db.ts         # chat 路由专用 DB 操作
│   ├── artifacts-db.ts    # artifact 工具专用 DB 操作
│   └── models-db.ts       # model_config CRUD（含脱敏）
└── (删除 queries.ts、utils.ts、migrate.ts、migrations/、schema.ts)
```

### 7.3 复合主键表处理

- **查询**：用 `eq('id', documentId)` + `order('created_at')`，或用 `document_latest` View 查最新版本
- **upsert**：指定 `onConflict: 'chat_id,message_id'`（vote 表）
- **版本化更新**：`updateDocumentContent` 通过插入新版本实现（不 update 旧版本）

### 7.4 SWR + supabase-js 适配

保持现有 SWR 数据获取模式，仅 fetcher 适配 supabase-js：

```ts
// hooks/use-chat-history.ts
export function useChatHistory() {
  const supabase = createClient();
  return useSWR('chat-history', async () => {
    const { data, error } = await supabase
      .from('chat')
      .select('id, title, visibility, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  });
}
```

---

## 8. 文件存储设计

### 8.1 Bucket 设计

| Bucket 名 | 公开性 | 用途 |
|---|---|---|
| `chat-attachments` | **私有** | 聊天附件图片（JPEG/PNG，5MB 上限） |

### 8.2 文件路径规范

```
chat-attachments/
  └── {user_id}/
      └── {chat_id}/
          └── {timestamp}_{random}.{ext}
```

RLS 基于 `storage.foldername(name)[1] = auth.uid()` 校验所有权。

### 8.3 上传方案：客户端直传

- **流程**：客户端校验 → `supabase.storage.upload()` → RLS 校验路径 → `createSignedUrl` 获取临时 URL
- **删除 `/api/files/upload` 路由**
- **数据库存 path 不存 url**：signed URL 会过期，path 是永久标识

### 8.4 Storage RLS 策略

- **insert**：`bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text`
- **select**：同上
- **delete**：同上
- **update**：同上

### 8.5 孤儿文件清理

删除 chat 时应用层同步清理 Storage 文件（查询 message.attachments → 批量 remove → 删除 chat）。

---

## 9. AI 链路设计

### 9.1 改造原则

**架构不变，仅适配数据访问层**：
- `streamText` + AI SDK 模式保留
- 移除 `resumable-stream`，直接用 `result.toUIMessageStreamResponse()`
- DB 调用从 drizzle 改为 admin client
- userId 通过 messages metadata 注入 AI 工具上下文

### 9.2 chat 路由改造

| 改造点 | 改造前 | 改造后 |
|---|---|---|
| 鉴权 | `await auth()` (NextAuth) | `await supabase.auth.getUser()` |
| 限流 | drizzle innerJoin | `supabase.rpc('get_message_count_by_user_id')` |
| 模型配置 | drizzle 查询 | admin client 查询（含 api_key） |
| 持久化 | drizzle 写入 | admin client 写入 |
| 流式输出 | resumable-stream 包装 | 直接 `toUIMessageStreamResponse()` |
| Stream 表 | 写入 streamId | **移除** |

### 9.3 AI 工具改造

5 个 AI 工具中 4 个有 DB 调用（create-document / edit-document / update-document / request-suggestions），统一改为调用 `lib/ai/artifacts-db.ts`（admin client）。get-weather 无 DB 调用，不改。

### 9.4 model_config 脱敏层

- **API 路由 GET 返回**：剥离 `api_key`（`getAllModelConfigsForClient`）
- **服务端 AI 链路**：用完整配置（含 `api_key`）
- **model_config 表不启用 RLS**，仅 service_role 访问

---

## 10. 前端改造设计

### 10.1 鉴权 hooks

- **`useUser`**（新增）：封装 `getUser` + `onAuthStateChange` 订阅 + user_profile 查询
- **`useRequireAuth`**（新增）：路由守卫 hook

### 10.2 数据获取 hooks（SWR + supabase-js）

| Hook | 替代的 API 路由 |
|---|---|
| `useChatHistory` | `/api/history` |
| `useMessages` | `/api/messages` |
| `useDocuments` / `useLatestDocument` | `/api/document` |
| `useVotes` + `voteMessage` | `/api/vote` |
| `useSuggestions` | `/api/suggestions` |

### 10.3 聊天 hooks

- `use-active-chat`：移除 `resumeStream` 相关逻辑
- `use-auto-resume`：**删除**

### 10.4 组件改造

- `app/layout.tsx`：移除 SessionProvider，新增 SWRProvider
- `sidebar-user-nav` / `auth-form` / `sign-out-form`：改用 supabase.auth
- `sidebar-history` / `messages` / `vote`：数据源切换为 SWR hooks

---

## 11. 部署与配置设计

### 11.1 环境变量

```bash
# Supabase（必需）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI（保留）
AI_GATEWAY_API_KEY=your-ai-gateway-key

# 移除：AUTH_SECRET / POSTGRES_URL / REDIS_URL / UPLOAD_DIR
```

### 11.2 依赖变更

**移除**（7 个）：drizzle-orm / drizzle-kit / postgres / next-auth / bcrypt-ts / redis / resumable-stream / dotenv

**新增**（2 个）：@supabase/supabase-js / @supabase/ssr

### 11.3 配置文件改造

| 文件 | 操作 |
|---|---|
| `drizzle.config.ts` | **删除** |
| `lib/db/migrate.ts` + `migrations/` | **删除** |
| `lib/db/schema.ts` | **删除** |
| `Dockerfile` | 改造（移除 `mkdir uploads`） |
| `docker-compose.yml` | 改造（移除 postgres/redis，仅保留 app） |
| `package.json` | 改造（scripts + dependencies） |
| `vercel-template.json` | 改造（移除 neon/upstash/blob，新增 supabase） |
| `next.config.ts` | 改造（新增 supabase.co 图片域名） |
| `.github/workflows/playwright.yml` | 改造（用本地 Supabase 替代 docker-compose） |
| `supabase/` | **新增**（config.toml + migrations + seed） |

### 11.4 package.json scripts 改造

- `build`：移除 `tsx lib/db/migrate`（迁移改到 Supabase 侧手动执行）
- `db:*`：从 drizzle-kit 改为 supabase CLI
- 新增 `db:generate`：生成 TypeScript 类型

### 11.5 部署流程

**Vercel + Supabase 云**：
1. 创建 Supabase 项目 → 获取 URL + anon key + service_role key
2. `supabase db push` 推送 schema + RLS policy
3. `supabase gen types` 生成 TypeScript 类型
4. 创建 Storage bucket（chat-attachments，私有）
5. Vercel 导入仓库 → 配置环境变量 → 部署

**本地开发**（先连云）：
```bash
cp .env.example .env.local
# 填入 Supabase 云的 URL 和 key
pnpm dev
```

### 11.6 本地自托管 Supabase（未来选项）

未来若要本地部署 Supabase，只需切换 3 个环境变量：
- `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=本地 key`
- `SUPABASE_SERVICE_ROLE_KEY=本地 key`

零代码改动，Supabase 本地/云完全兼容。

---

## 12. 技术选型

### 12.1 选型决策

| 选型 | 决策 | 理由 |
|---|---|---|
| ORM | supabase-js（PostgREST） | 与 RLS 天然配合，客户端可直查 |
| Auth | Supabase Auth | 内置 bcrypt、OAuth、Magic Link，与 RLS 联动 |
| Storage | Supabase Storage | 私有 bucket + RLS + signed URL |
| Redis | **不使用** | Upstash REST 不兼容 pub/sub，TCP 端点 Serverless 有硬伤 |
| 断线续传 | **放弃** | 当前恢复端点是 stub，功能未实际启用 |

### 12.2 备选方案（未选择）

| 备选 | 未选择原因 |
|---|---|
| 保留 drizzle 直连 Supabase Postgres | 无法发挥 RLS 价值，service_role 绕过 RLS 等于没设 |
| 保留 Upstash Redis TCP 端点 | Vercel Serverless 下连接数/超时硬伤 |
| 用 Supabase Realtime 重写断线续传 | AI SDK SSE 与 Realtime WebSocket 模型不匹配，工作量大 |
| 混合 RLS（读直查 + 写走 API） | 两套数据访问模式，心智负担大 |

---

## 13. 实施计划

### 13.1 里程碑

| 阶段 | 内容 | 依赖 |
|---|---|---|
| M1: Supabase 项目初始化 | 创建项目、推送 schema、生成类型、创建 bucket | 无 |
| M2: 鉴权层迁移 | 移除 NextAuth、接入 Supabase Auth、改造 proxy.ts | M1 |
| M3: 数据访问层迁移 | 移除 drizzle、拆分 queries.ts、创建 supabase 客户端 | M1 |
| M4: 文件存储迁移 | 移除本地磁盘、接入 Supabase Storage、客户端直传 | M1 |
| M5: AI 链路适配 | chat 路由改造、AI 工具改造、移除 resumable-stream | M2, M3 |
| M6: 前端改造 | hooks 改造、组件改造、SWR 适配 | M2, M3 |
| M7: 部署配置改造 | Dockerfile、docker-compose、CI/CD、环境变量 | M1-M6 |
| M8: 测试与验证 | biome、playwright、pnpm check、lint | M1-M7 |

### 13.2 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| 复合主键表在 PostgREST 下操作异常 | 中 | 中 | 用 View + RPC + onConflict 处理，提前测试 |
| RLS policy 漏配导致数据泄露 | 中 | 高 | 编写 RLS 测试用例，覆盖所有表 |
| Supabase Free tier 限制（连接数/存储） | 低 | 中 | 监控用量，必要时升级 |
| AI 工具上下文 userId 传递失败 | 中 | 中 | 在 chat 路由显式校验，失败时中断流 |
| 移除断线续传后用户体验下降 | 低 | 低 | 文档说明，未来可用 Realtime 增强 |

---

## 14. 验收标准

### 14.1 功能验收

- [ ] 用户可注册、登录、退出（Supabase Auth）
- [ ] 用户可创建、查看、删除 chat（RLS 隔离）
- [ ] AI 对话流式输出正常（无 resumable-stream）
- [ ] 文件上传到 Supabase Storage，signed URL 可访问
- [ ] 文档版本管理正常（复合主键表）
- [ ] 消息投票正常（复合主键 upsert）
- [ ] 模型配置 CRUD 正常（api_key 不泄露到客户端）
- [ ] 公开 chat 可被其他用户查看（RLS policy）

### 14.2 非功能验收

- [ ] 无 drizzle-orm / next-auth / bcrypt-ts / redis / resumable-stream 依赖
- [ ] 所有表启用 RLS（model_config 除外）
- [ ] biome / playwright / pnpm check / lint 全部通过
- [ ] Vercel + Supabase 云部署成功
- [ ] 本地开发可连云 Supabase

### 14.3 安全验收

- [ ] 客户端用 anon key 无法访问他人数据（RLS 生效）
- [ ] service_role key 仅在服务端使用，不暴露给客户端
- [ ] model_config.api_key 不出现在任何客户端响应中
- [ ] Storage 文件无法被未授权用户访问（私有 bucket + RLS）

---

## 附录 A：关键文件路径汇总

### 新增文件

| 文件 | 用途 |
|---|---|
| `lib/supabase/client.ts` | 浏览器客户端 |
| `lib/supabase/server.ts` | 服务端客户端 |
| `lib/supabase/admin.ts` | 特权客户端 |
| `lib/supabase/types.ts` | 类型导出 |
| `lib/db/database.types.ts` | supabase gen types 生成 |
| `lib/db/server-queries.ts` | 服务端特权查询 |
| `lib/ai/chat-db.ts` | chat 路由 DB 操作 |
| `lib/ai/artifacts-db.ts` | artifact 工具 DB 操作 |
| `lib/ai/models-db.ts` | model_config CRUD |
| `lib/storage/client.ts` | Storage 客户端工具 |
| `hooks/use-user.ts` | 用户状态 hook |
| `hooks/use-require-auth.ts` | 路由守卫 hook |
| `hooks/use-chat-history.ts` | 历史记录 hook |
| `hooks/use-documents.ts` | 文档 hook |
| `hooks/use-votes.ts` | 投票 hook |
| `hooks/use-suggestions.ts` | 建议 hook |
| `components/providers/swr-provider.tsx` | SWR 全局配置 |
| `components/chat/attachment-upload.tsx` | 附件上传组件 |
| `components/chat/message-attachments.tsx` | 附件渲染组件 |
| `supabase/config.toml` | Supabase 项目配置 |
| `supabase/migrations/00001_initial_schema.sql` | 初始 schema |
| `supabase/migrations/00002_rls_policies.sql` | RLS 策略 |
| `supabase/migrations/00003_views_and_rpc.sql` | View 与 RPC |
| `supabase/migrations/00004_storage_policies.sql` | Storage 策略 |
| `supabase/seed.sql` | 种子数据 |

### 删除文件

| 文件 | 原因 |
|---|---|
| `lib/db/queries.ts` | 拆分到多处 |
| `lib/db/utils.ts` | 密码哈希不再需要 |
| `lib/db/migrate.ts` | 迁移改到 Supabase 侧 |
| `lib/db/migrations/` | 整个目录删除 |
| `lib/db/schema.ts` | drizzle schema 删除 |
| `drizzle.config.ts` | drizzle 移除 |
| `app/(auth)/auth.ts` | NextAuth 移除 |
| `app/(auth)/auth.config.ts` | NextAuth 移除 |
| `app/(auth)/actions.ts` | 改客户端直接调用 |
| `app/(auth)/api/auth/[...nextauth]/` | NextAuth 路由删除 |
| `app/(chat)/api/files/upload/route.ts` | 改客户端直传 |
| `app/(chat)/api/history/route.ts` | RLS 替代 |
| `app/(chat)/api/messages/route.ts` | RLS 替代 |
| `app/(chat)/api/document/route.ts` | RLS 替代 |
| `app/(chat)/api/vote/route.ts` | RLS 替代 |
| `app/(chat)/api/suggestions/route.ts` | RLS 替代 |
| `app/(chat)/api/chat/[id]/stream/route.ts` | 放弃断线续传 |
| `hooks/use-auto-resume.ts` | 放弃断线续传 |

### 改造文件

| 文件 | 改造内容 |
|---|---|
| `app/layout.tsx` | 移除 SessionProvider，新增 SWRProvider |
| `app/(auth)/login/page.tsx` | 客户端直接调用 Supabase Auth |
| `app/(auth)/register/page.tsx` | 客户端直接调用 Supabase Auth |
| `app/(auth)/layout.tsx` | 移除 SessionProvider 引用 |
| `proxy.ts` | NextAuth getToken → Supabase getUser |
| `app/(chat)/api/chat/route.ts` | 移除 resumable-stream，DB 调用改 admin client |
| `app/(chat)/api/models/route.ts` | 脱敏 api_key |
| `app/(chat)/api/models/test/route.ts` | admin client 查询 |
| `app/(chat)/actions.ts` | DB 调用改 admin client |
| `lib/ai/providers.ts` | admin client 查询模型配置 |
| `lib/ai/models.ts` | admin client 查询 |
| `lib/ai/tools/*.ts`（4 个） | DB 调用改 admin client |
| `components/chat/auth-form.tsx` | supabase.auth |
| `components/chat/sign-out-form.tsx` | supabase.auth.signOut |
| `components/chat/sidebar-user-nav.tsx` | useUser hook |
| `components/chat/sidebar-history.tsx` | useChatHistory hook |
| `components/chat/messages.tsx` | useMessages hook |
| `components/chat/vote.tsx` | useVotes hook |
| `hooks/use-active-chat.tsx` | 移除 resumeStream |
| `hooks/use-messages.ts` | 改造 fetcher |
| `hooks/use-models.ts` | 仍调 API（脱敏数据） |
| `lib/constants.ts` | 移除 DUMMY_PASSWORD |
| `package.json` | scripts + dependencies |
| `Dockerfile` | 移除 mkdir uploads |
| `docker-compose.yml` | 移除 postgres/redis |
| `.env.example` | 环境变量更新 |
| `vercel-template.json` | 集成更新 |
| `next.config.ts` | 新增 supabase.co 图片域名 |
| `.github/workflows/playwright.yml` | 本地 Supabase 替代 docker-compose |
| `README.md` | 部署文档更新 |

---

## 附录 B：改造影响统计

| 维度 | 改造前 | 改造后 |
|---|---|---|
| API 路由数 | 11 | 3 |
| `lib/db/queries.ts` | 795 行，30 个函数 | 删除（拆分到 ~440 行分散模块） |
| 依赖数（数据库+鉴权+存储+缓存） | 8 个 | 2 个（@supabase/supabase-js + @supabase/ssr） |
| 环境变量数 | 4 | 4（语义变化） |
| 表数 | 8 | 7（删除 Stream） |
| RLS policy 数 | 0 | ~20 |
| 部署服务依赖 | Vercel + Postgres + Redis | Vercel + Supabase |
