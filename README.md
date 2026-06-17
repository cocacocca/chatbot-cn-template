<a href="https://chatbot.ai-sdk.dev/demo">
  <img alt="Chatbot" src="app/(chat)/opengraph-image.png">
  <h1 align="center">Chatbot</h1>
</a>

<p align="center">
    Chatbot (formerly AI Chatbot) is a free, open-source template built with Next.js and the AI SDK that helps you quickly build powerful chatbot applications.
</p>

<p align="center">
  <a href="https://chatbot.ai-sdk.dev/docs"><strong>Read Docs</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#running-locally"><strong>Running locally</strong></a>
</p>
<br/>

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://ai-sdk.dev/docs/introduction)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports OpenAI, Anthropic, Google, xAI, and other OpenAI-compatible model providers
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Supabase](https://supabase.com) Postgres database for saving chat history and user data
  - [Supabase Storage](https://supabase.com/docs/guides/storage) for efficient file storage
- [Auth.js](https://authjs.dev)
  - Simple and secure authentication

## Model Providers

This template supports multiple AI models through an OpenAI-compatible interface. Models are managed in `/settings` (stored in the Supabase `cct_model_config` table) with per-model `baseUrl` and `apiKey` routing. When no model is configured in the database, the AI pipeline falls back to a single default model configured via `OPENAI_` environment variables.

### Default Model Fallback

If the database has no model configurations, the app uses the following environment variables as a default fallback (OpenAI-compatible):

- `OPENAI_API_KEY` - API key for the default model
- `OPENAI_BASE_MODEL` - Default model id (e.g. `gpt-4o-mini`)
- `OPENAI_BASE_URL` - OpenAI-compatible base URL (e.g. `https://api.openai.com/v1`)

With the [AI SDK](https://ai-sdk.dev/docs/introduction), you can also switch to direct LLM providers like [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://ai-sdk.dev/providers/ai-sdk-providers) with just a few lines of code.

## Deploy Your Own

You can deploy your own version of Chatbot to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/templates/next.js/chatbot)

### Prerequisites

1. Create a [Supabase](https://supabase.com) project and obtain the following from your project settings:
   - `NEXT_PUBLIC_SUPABASE_URL` - Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon (public) key
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)
2. (Optional) Prepare an OpenAI-compatible API key and model id for the default fallback (`OPENAI_API_KEY`, `OPENAI_BASE_MODEL`, `OPENAI_BASE_URL`). Required only if you do not configure any model in `/settings`.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `OPENAI_API_KEY` | Default fallback API key (used when DB has no model config) |
| `OPENAI_BASE_MODEL` | Default fallback model id (e.g. `gpt-4o-mini`) |
| `OPENAI_BASE_URL` | Default fallback OpenAI-compatible base URL |

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Chatbot. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

1. Create a [Supabase](https://supabase.com) project and obtain your project URL, anon key, and service role key from the project settings.
2. (Optional) Prepare an OpenAI-compatible API key and model id for the default fallback (`OPENAI_API_KEY`, `OPENAI_BASE_MODEL`, `OPENAI_BASE_URL`). Required only if you do not configure any model in `/settings`.
3. Copy `.env.example` to `.env` and fill in the values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `OPENAI_BASE_MODEL`
   - `OPENAI_BASE_URL`
4. Apply the database schema to your Supabase project:
   ```bash
   pnpm db:push
   ```
5. Generate TypeScript types from your Supabase schema (optional, requires `SUPABASE_PROJECT_REF`):
   ```bash
   pnpm db:generate
   ```

```bash
pnpm install
pnpm db:push # Apply database schema to Supabase
pnpm dev
```

Your app template should now be running on [localhost:30000](http://localhost:30000).
