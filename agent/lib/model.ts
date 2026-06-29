/**
 * @file EVE Agent 共享模型工厂
 * @description 为 root agent 与 subagents 统一创建 OpenAI 兼容的 LanguageModel 实例。
 *
 *   数据库为唯一真实源（single source of truth），解析顺序：
 *   1. 数据库全局默认模型（cct_model_config 中 is_default=true）
 *   2. 数据库第一条模型（无默认标记时兜底，避免有模型却用不上）
 *   3. .env.local 的 OPENAI_*（首次启动引导）
 *
 *   EVE 在编译期根据传给 defineAgent({ model }) 的值类型决定路由：
 *   - 裸字符串 → AI Gateway 路由，本项目不使用。
 *   - provider 实例 → external 路由，直连 OpenAI 兼容端点。
 *   因此本工厂始终返回 provider 实例。
 *
 *   注意：EVE 主对话模型是进程内全局唯一、启动时绑定的，无法按用户切换。
 *   在 /settings 修改模型后需重启 dev server 让 agent 模块重新加载绑定。
 * @module agent/lib/model
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { ModelConfig } from "@/lib/ai/models-db";
import {
  getAllGlobalModelConfigs,
  getGlobalDefaultModelConfig,
} from "@/lib/ai/models-db";

/**
 * 根据 ModelConfig 创建 OpenAI 兼容实例。
 *
 * @param config 数据库模型配置（含 apiKey / baseUrl / id）
 * @returns OpenAI 兼容的 LanguageModel 实例
 */
function createModelFromConfig(config: ModelConfig): LanguageModel {
  const client = createOpenAI({
    apiKey: config.apiKey ?? undefined,
    ...(config.baseUrl && { baseURL: config.baseUrl }),
  });
  return client.chat(config.id);
}

/**
 * 从环境变量创建 OpenAI 兼容实例（引导 fallback）。
 *
 * 仅当 OPENAI_API_KEY 与 OPENAI_BASE_MODEL 均已配置时才创建真实实例。
 * 环境变量缺失时返回 null，由调用方决定如何处理——避免用空值创建
 * 一个必然请求失败（如 baseURL 为空字符串导致 Invalid URL）的占位实例。
 *
 * @returns OpenAI 兼容 LanguageModel 实例；env 未配置时返回 null
 */
function tryCreateEnvFallbackModel(): LanguageModel | null {
  const apiKey = process.env.OPENAI_API_KEY;
  const modelId = process.env.OPENAI_BASE_MODEL;
  if (!apiKey || !modelId) {
    return null;
  }
  const client = createOpenAI({
    apiKey,
    ...(process.env.OPENAI_BASE_URL && {
      baseURL: process.env.OPENAI_BASE_URL,
    }),
  });
  return client.chat(modelId);
}

/**
 * 创建 EVE 主对话用的 OpenAI 兼容模型实例（数据库优先）。
 *
 * 解析顺序：
 * 1. 数据库全局默认模型（is_default=true）→ 用其配置创建实例
 * 2. 数据库第一条模型（无默认标记时兜底，避免有模型却用不上）
 * 3. .env.local 的 OPENAI_*（首次启动引导）
 * 4. 以上都不可用 → 抛出清晰错误，指引配置入口
 *
 * 始终返回 provider 实例（external 路由，直连外部 API），绝不返回字符串。
 * 调用方需用顶层 await（ESM）等待异步查库完成。
 *
 * @returns OpenAI 兼容的 LanguageModel 实例
 * @throws 数据库与环境变量均无可用模型配置时抛出
 */
export async function getEveModel(): Promise<LanguageModel> {
  try {
    // 1. 优先全局默认模型
    const defaultConfig = await getGlobalDefaultModelConfig();
    if (defaultConfig?.apiKey) {
      return createModelFromConfig(defaultConfig);
    }

    // 2. 无默认模型时，取数据库第一条作为兜底（避免有模型却用不上）
    const allConfigs = await getAllGlobalModelConfigs();
    const firstWithKey = allConfigs.find((c) => c.apiKey);
    if (firstWithKey) {
      console.warn(
        `[getEveModel] No model marked is_default; falling back to first DB model "${firstWithKey.id}". Mark one as default in /settings to make this explicit.`
      );
      return createModelFromConfig(firstWithKey);
    }
  } catch (error) {
    // 查库失败（如服务未就绪）时降级到 env fallback
    console.error(
      "[getEveModel] Failed to read models from DB, falling back to env:",
      error
    );
  }

  // 3. 数据库无可用模型 → env fallback
  const envModel = tryCreateEnvFallbackModel();
  if (envModel) {
    return envModel;
  }

  // 4. 均不可用 → 抛出清晰错误
  throw new Error(
    "[getEveModel] No model configured. Add a model in /settings (and mark one as default), or set OPENAI_API_KEY + OPENAI_BASE_MODEL in .env.local as bootstrap fallback."
  );
}
