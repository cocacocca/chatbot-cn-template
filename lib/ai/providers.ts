import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import {
  getAllModelConfigs,
  getModelConfigById,
  getTitleModelConfig,
} from "@/lib/ai/models-db";

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

// 环境变量 fallback：当数据库无模型配置时使用
function getEnvFallbackModelId(): string | undefined {
  return process.env.OPENAI_BASE_MODEL || undefined;
}

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
