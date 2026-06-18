<a href="https://github.com/cocacocca/chatbot-cn-template/wiki">
  <img alt="Chatbot" src="app/(chat)/opengraph-image.png">
  <h1 align="center">Chatbot 中文模板</h1>
</a>

<p align="center">
  基于 <a href="https://github.com/vercel/ai-chatbot">Vercel AI Chatbot Template</a> 二次开发的中文 AI 聊天机器人模板，使用 Supabase 完全替代原有数据层，开箱即用、可独立部署。
</p>

<p align="center">
  <a href="https://github.com/cocacocca/chatbot-cn-template/wiki"><strong>📖 Wiki 文档</strong></a> ·
  <a href="#主要改进"><strong>主要改进</strong></a> ·
  <a href="#快速开始"><strong>快速开始</strong></a> ·
  <a href="#部署"><strong>部署</strong></a>
</p>
<br/>

## 主要改进

相较于 Vercel 原版模板，本项目做了以下改进：

- **Supabase 完全替代**：移除 Drizzle ORM + NextAuth + Redis，使用 Supabase Auth + Postgres + Storage 统一数据层，全表启用 RLS（行级安全）
- **OpenAI 兼容多模型**：支持任意 OpenAI 兼容接口（如硅基流动、DeepSeek、Moonshot），模型配置存于数据库按用户隔离，环境变量作为 fallback
- **中文本地化**：界面、系统提示词、错误提示全面中文化
- **多项目隔离**：所有数据库对象使用 `cct_` 前缀，支持多项目共用一个 Supabase 实例
- **Next.js 16 适配**：启用 Cache Components、React Compiler、Turbopack，所有动态数据访问包裹在 `<Suspense>` 边界内

## 核心特性

- [Next.js 16](https://nextjs.org) App Router + RSC + Server Actions
- [AI SDK](https://ai-sdk.dev) `streamText` 流式响应 + 多轮工具调用
- [Supabase](https://supabase.com) Auth（SSR cookie）+ Postgres（RLS）+ Storage（附件）
- [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS 4](https://tailwindcss.com) + [Radix UI](https://radix-ui.com)
- Artifact 系统：text / code / sheet / image 四类可编辑文档
- ProseMirror + CodeMirror + react-data-grid 编辑器
- Pyodide 浏览器端 Python 执行

## 快速开始

### 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | 22+ | 推荐 LTS |
| pnpm | 10.32.1 | 由 `package.json` 的 `packageManager` 字段锁定 |
| Docker | — | 本地启动 Supabase 时需要 |

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/cocacocca/chatbot-cn-template.git
cd chatbot-cn-template

# 2. 启用 pnpm（Node 16+ 自带 corepack）
corepack enable

# 3. 安装依赖
pnpm install

# 4. 启动本地 Supabase（需要 Docker 运行中）
npx supabase start
# 记录输出的 API URL、anon key、service role key

# 5. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入上一步的密钥和 AI 配置

# 6. 启动开发服务器
pnpm dev
```

访问 http://localhost:30000 即可使用。

### 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | Supabase 匿名密钥（客户端可见） |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | Supabase 服务密钥（仅服务端，绕 RLS） |
| `OPENAI_API_KEY` | 是 | OpenAI 兼容 API 密钥 |
| `OPENAI_BASE_MODEL` | 否 | 默认模型（DB 无配置时 fallback） |
| `OPENAI_BASE_URL` | 否 | OpenAI 兼容基础 URL |

> `OPENAI_*` 支持任意 OpenAI 兼容接口。DB 有模型配置时优先用 DB 配置。

## 部署

### Vercel 部署（推荐）

1. Fork 本仓库到你的 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量（见上表）
4. 部署完成

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Docker 部署

```bash
docker compose up -d
```

详见 [Docker 部署文档](https://github.com/cocacocca/chatbot-cn-template/wiki/Deployment)。

## 文档

完整的开发文档托管在 GitHub Wiki：

- 📖 [Wiki 首页](https://github.com/cocacocca/chatbot-cn-template/wiki)
- 🏗 [架构总览](https://github.com/cocacocca/chatbot-cn-template/wiki/Architecture)
- 🚀 [环境搭建](https://github.com/cocacocca/chatbot-cn-template/wiki/Environment-Setup)
- 🛠 [开发指南](https://github.com/cocacocca/chatbot-cn-template/wiki/Development-Guide)
- 📦 [模块开发指南](https://github.com/cocacocca/chatbot-cn-template/wiki/Module-Guide)
- 🗄 [Supabase 联合开发](https://github.com/cocacocca/chatbot-cn-template/wiki/Supabase-Client-Boundaries)
- 🚢 [部署运维](https://github.com/cocacocca/chatbot-cn-template/wiki/Deployment)
- 🔧 [故障排查](https://github.com/cocacocca/chatbot-cn-template/wiki/Troubleshooting)

## 致谢

本项目基于 [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot) 二次开发，感谢 Vercel 团队的开源贡献。

## License

MIT
