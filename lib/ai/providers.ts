/** @file AI 模型 provider 工厂：根据数据库或环境变量配置创建 OpenAI 兼容客户端并返回对应的语言模型实例。 */
import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import {
  getAllModelConfigs,
  getModelConfigById,
  getTitleModelConfig,
} from "@/lib/ai/models-db";

/**
 * 创建一个 OpenAI 兼容客户端。
 * apiKey 必填（缺失时抛错并提示配置入口）；baseUrl 可选，传入时覆盖默认地址。
 *
 * @param baseUrl 自定义 API 基础地址（可选）
 * @param apiKey API 密钥（必填）
 * @returns OpenAI 兼容客户端实例
 */
function createClientForModel(
  baseUrl: string | null | undefined,
  apiKey: string | null | undefined
) {
  if (!apiKey) {
    throw new Error(
      "API Key is required. Configure it per-model in Settings (/settings), or set OPENAI_API_KEY as fallback."
    );
  }

  return createOpenAI({
    apiKey,
    ...(baseUrl && { baseURL: baseUrl }),
  });
}

/**
 * 读取环境变量 `OPENAI_BASE_MODEL` 作为 fallback 模型 id。
 *
 * @returns 环境变量配置的模型 id；未配置时返回 undefined
 */
// 环境变量 fallback：当数据库无模型配置时使用
function getEnvFallbackModelId(): string | undefined {
  return process.env.OPENAI_BASE_MODEL || undefined;
}

/**
 * 根据 modelId 获取语言模型实例。
 * userId 可选：传入时优先按用户隔离查询数据库模型配置；未传入或数据库未命中时，
 * 若 modelId 匹配环境变量默认模型，则使用环境变量创建客户端。
 *
 * @param modelId 模型 id
 * @param userId 用户 id（可选）
 * @returns OpenAI 兼容的语言模型实例
 * @throws 找不到模型配置时抛错
 */
// userId 可选：传入时按用户隔离查询模型配置；未传入时仅允许使用环境变量 fallback
export async function getLanguageModel(modelId: string, userId?: string) {
  // 先查用户的模型配置（若提供 userId）
  if (userId) {
    const config = await getModelConfigById(userId, modelId);

    if (config) {
      const client = createClientForModel(config.baseUrl, config.apiKey);
      return client.chat(config.id);
    }
  }

  // fallback: 数据库未找到时，若 modelId 匹配环境变量默认模型，则用环境变量创建客户端
  const envModelId = getEnvFallbackModelId();
  if (envModelId && modelId === envModelId) {
    const envApiKey = process.env.OPENAI_API_KEY;
    const envBaseUrl = process.env.OPENAI_BASE_URL;
    const client = createClientForModel(envBaseUrl, envApiKey);
    return client.chat(envModelId);
  }

  throw new Error(
    `Model "${modelId}" not found in database. Add it in Settings (/settings), or set OPENAI_BASE_MODEL to match as fallback.`
  );
}

/**
 * 获取用于生成会话标题的语言模型实例。
 * userId 可选：传入时按用户隔离查询标题模型；未配置标题模型时 fallback 到首个已配置模型；
 * 数据库完全无配置时 fallback 到环境变量。
 *
 * @param userId 用户 id（可选）
 * @returns OpenAI 兼容的语言模型实例
 * @throws 无任何可用模型配置时抛错
 */
// userId 可选：传入时按用户隔离查询标题模型；未传入时仅允许使用环境变量 fallback
export async function getTitleModel(userId?: string) {
  // 先查用户的标题模型配置（若提供 userId）
  if (userId) {
    const config = await getTitleModelConfig(userId);

    // fallback 1: 没有专门配置 title model 时，使用第一个已配置的模型
    const fallbackConfig = config ?? (await getAllModelConfigs(userId))[0];

    if (fallbackConfig) {
      const client = createClientForModel(
        fallbackConfig.baseUrl,
        fallbackConfig.apiKey
      );
      return client.chat(fallbackConfig.id);
    }
  }

  // fallback 2: 数据库完全没有模型配置时，使用环境变量
  const envModelId = getEnvFallbackModelId();
  if (envModelId) {
    const envApiKey = process.env.OPENAI_API_KEY;
    const envBaseUrl = process.env.OPENAI_BASE_URL;
    const client = createClientForModel(envBaseUrl, envApiKey);
    return client.chat(envModelId);
  }

  throw new Error(
    "No models configured. Add a model in Settings (/settings), or set OPENAI_BASE_MODEL / OPENAI_API_KEY as fallback."
  );
}
