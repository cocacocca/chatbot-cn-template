import "server-only";

import {
  getAllModelConfigs,
  getDefaultModelConfig,
  getTitleModelConfig,
} from "@/lib/ai/models-db";

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  baseUrl?: string | null;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  capabilities: ModelCapabilities;
};

// 环境变量 fallback 模型 id
function getEnvFallbackModelId(): string | undefined {
  return process.env.OPENAI_BASE_MODEL || undefined;
}

// 从环境变量构造单一默认模型（数据库为空时使用）
function getEnvFallbackChatModel(): ChatModel | null {
  const envModelId = getEnvFallbackModelId();
  if (!envModelId) {
    return null;
  }
  return {
    id: envModelId,
    name: envModelId,
    provider: "openai",
    description: `${envModelId} (env fallback)`,
    baseUrl: process.env.OPENAI_BASE_URL || null,
    capabilities: { tools: true, vision: false, reasoning: false },
  };
}

// userId 可选：传入时按用户隔离查询；未传入时仅返回环境变量 fallback
export async function getChatModels(userId?: string): Promise<ChatModel[]> {
  // 数据库有模型 → 返回数据库模型列表
  if (userId) {
    const configs = await getAllModelConfigs(userId);
    if (configs.length > 0) {
      return configs.map((c) => ({
        id: c.id,
        name: c.name,
        provider: c.provider,
        description: `${c.name} by ${c.provider}`,
        baseUrl: c.baseUrl,
        reasoningEffort:
          (c.reasoningEffort as ChatModel["reasoningEffort"]) ?? undefined,
        capabilities: c.capabilities as ModelCapabilities,
      }));
    }
  }

  // 数据库为空 → 返回单一默认模型（从环境变量构造）
  const envModel = getEnvFallbackChatModel();
  return envModel ? [envModel] : [];
}

// userId 可选：传入时按用户隔离查询；未传入时仅返回环境变量 fallback
export async function getDefaultModelId(userId?: string): Promise<string> {
  if (userId) {
    const config = await getDefaultModelConfig(userId);
    if (config?.id) {
      return config.id;
    }
    // fallback 1: 首个配置模型
    const allConfigs = await getAllModelConfigs(userId);
    if (allConfigs[0]?.id) {
      return allConfigs[0].id;
    }
  }
  // fallback 2: 环境变量默认模型
  return getEnvFallbackModelId() ?? "";
}

// userId 可选：传入时按用户隔离查询；未传入时仅返回环境变量 fallback
export async function getTitleModelId(userId?: string): Promise<string> {
  if (userId) {
    const config = await getTitleModelConfig(userId);
    if (config?.id) {
      return config.id;
    }
    // fallback 1: 首个配置模型
    const allConfigs = await getAllModelConfigs(userId);
    if (allConfigs[0]?.id) {
      return allConfigs[0].id;
    }
  }
  // fallback 2: 环境变量默认模型
  return getEnvFallbackModelId() ?? "";
}

// userId 可选：传入时按用户隔离查询；未传入时仅校验环境变量 fallback
export async function getModelCapabilitiesMap(
  userId?: string
): Promise<Record<string, ModelCapabilities>> {
  const models = await getChatModels(userId);
  return Object.fromEntries(models.map((m) => [m.id, m.capabilities]));
}

// userId 可选：传入时按用户隔离校验；未传入时仅校验环境变量 fallback
export async function isAllowedModelId(
  userId?: string,
  modelId?: string
): Promise<boolean> {
  if (!modelId) {
    return false;
  }

  if (userId) {
    const configs = await getAllModelConfigs(userId);

    // 数据库为空 → 允许 modelId 匹配环境变量默认模型
    if (configs.length === 0) {
      return modelId === getEnvFallbackModelId();
    }

    // 数据库有模型 → 检查数据库列表
    return configs.some((c) => c.id === modelId);
  }

  // 未提供 userId → 仅允许环境变量默认模型
  return modelId === getEnvFallbackModelId();
}
