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

export async function getChatModels(): Promise<ChatModel[]> {
  const configs = await getAllModelConfigs();

  // 数据库有模型 → 返回数据库模型列表
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

  // 数据库为空 → 返回单一默认模型（从环境变量构造）
  const envModel = getEnvFallbackChatModel();
  return envModel ? [envModel] : [];
}

export async function getDefaultModelId(): Promise<string> {
  const config = await getDefaultModelConfig();
  if (config?.id) {
    return config.id;
  }
  // fallback 1: 首个配置模型
  const allConfigs = await getAllModelConfigs();
  if (allConfigs[0]?.id) {
    return allConfigs[0].id;
  }
  // fallback 2: 环境变量默认模型
  return getEnvFallbackModelId() ?? "";
}

export async function getTitleModelId(): Promise<string> {
  const config = await getTitleModelConfig();
  if (config?.id) {
    return config.id;
  }
  // fallback 1: 首个配置模型
  const allConfigs = await getAllModelConfigs();
  if (allConfigs[0]?.id) {
    return allConfigs[0].id;
  }
  // fallback 2: 环境变量默认模型
  return getEnvFallbackModelId() ?? "";
}

export async function getModelCapabilitiesMap(): Promise<
  Record<string, ModelCapabilities>
> {
  const models = await getChatModels();
  return Object.fromEntries(models.map((m) => [m.id, m.capabilities]));
}

export async function isAllowedModelId(modelId: string): Promise<boolean> {
  const configs = await getAllModelConfigs();

  // 数据库为空 → 允许 modelId 匹配环境变量默认模型
  if (configs.length === 0) {
    return modelId === getEnvFallbackModelId();
  }

  // 数据库有模型 → 检查数据库列表
  return configs.some((c) => c.id === modelId);
}
