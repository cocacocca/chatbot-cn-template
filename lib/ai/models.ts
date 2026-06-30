/** @file 聊天模型查询服务：聚合数据库模型配置与环境变量 fallback，对外提供模型列表与默认模型查询能力。 */
// import "server-only"; // 临时移除：eve CLI 与 server-only 存在兼容性问题

import {
  getAllModelConfigs,
  getDefaultModelConfig,
  getTitleModelConfig,
} from "@/lib/ai/models-db";

/** 模型能力集合：标识模型是否支持工具调用、视觉输入与推理。 */
export type ModelCapabilities = {
  /** 是否支持工具调用（function/tool calling）。 */
  tools: boolean;
  /** 是否支持视觉输入（图像理解）。 */
  vision: boolean;
  /** 是否支持推理（reasoning）能力。 */
  reasoning: boolean;
};

/** 聊天模型描述，包含模型基本信息、可选自定义 baseUrl 与推理强度配置。 */
export type ChatModel = {
  /** 模型唯一标识。 */
  id: string;
  /** 模型展示名称。 */
  name: string;
  /** 模型提供方（如 openai）。 */
  provider: string;
  /** 模型描述文本。 */
  description: string;
  /** 可选的自定义 API 基础地址。 */
  baseUrl?: string | null;
  /** 可选的推理强度等级。 */
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  /** 模型能力集合。 */
  capabilities: ModelCapabilities;
};

/**
 * 读取环境变量 `OPENAI_BASE_MODEL` 作为 fallback 模型 id。
 *
 * @returns 环境变量配置的模型 id；未配置时返回 undefined
 */
// 环境变量 fallback 模型 id
function getEnvFallbackModelId(): string | undefined {
  return process.env.OPENAI_BASE_MODEL || undefined;
}

/**
 * 从环境变量构造单一默认模型（数据库为空时使用）。
 * 模型 id、name 取自 `OPENAI_BASE_MODEL`，baseUrl 取自 `OPENAI_BASE_URL`。
 *
 * @returns 环境变量构造的模型；未配置 `OPENAI_BASE_MODEL` 时返回 null
 */
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

/**
 * 获取可用的聊天模型列表。
 * userId 可选：传入时按用户隔离查询数据库；未传入或数据库为空时仅返回环境变量 fallback。
 *
 * @param userId 用户 id（可选）
 * @returns 模型列表；数据库与环境变量均无配置时返回空数组
 */
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

/**
 * 获取默认模型 id。优先级：数据库 is_default 配置 > 数据库首个配置 > 环境变量 fallback。
 *
 * @param userId 用户 id（可选）
 * @returns 默认模型 id；均无配置时返回空字符串
 */
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

/**
 * 获取标题生成模型 id。优先级：数据库 is_title_model 配置 > 数据库首个配置 > 环境变量 fallback。
 *
 * @param userId 用户 id（可选）
 * @returns 标题模型 id；均无配置时返回空字符串
 */
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

/**
 * 构建模型 id → 能力集合 的映射表，用于快速查询某模型是否支持工具/视觉/推理。
 *
 * @param userId 用户 id（可选）
 * @returns 以模型 id 为键、能力对象为值的映射
 */
// userId 可选：传入时按用户隔离查询；未传入时仅校验环境变量 fallback
export async function getModelCapabilitiesMap(
  userId?: string
): Promise<Record<string, ModelCapabilities>> {
  const models = await getChatModels(userId);
  return Object.fromEntries(models.map((m) => [m.id, m.capabilities]));
}

/**
 * 校验给定 modelId 是否为用户允许使用的模型。
 * userId 可选：传入时按用户隔离校验数据库模型列表；未传入时仅校验环境变量 fallback。
 *
 * @param userId 用户 id（可选）
 * @param modelId 待校验的模型 id
 * @returns 允许使用返回 true，否则 false
 */
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
