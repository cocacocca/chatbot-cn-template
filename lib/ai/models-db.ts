/** @file 模型配置（cct_model_config 表）数据库访问层，提供按用户隔离的模型 CRUD 能力。 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/** 模型配置（应用层 camelCase 形态）。 */
type ModelConfig = {
  /** 模型 id（同时作为展示名称的 fallback）。 */
  id: string;
  /** 模型展示名称（数据库无 name 字段，使用 id 兜底）。 */
  name: string;
  /** 模型提供方。 */
  provider: string;
  /** 自定义 API 基础地址。 */
  baseUrl: string | null;
  /** API 密钥（仅服务端使用，客户端需脱敏）。 */
  apiKey: string | null;
  /** 模型能力集合。 */
  capabilities: any;
  /** 推理强度配置。 */
  reasoningEffort: string | null;
  /** 是否为用户的默认模型。 */
  isDefault: boolean;
  /** 是否为用户的标题生成模型。 */
  isTitleModel: boolean;
  /** 创建时间（ISO 字符串）。 */
  createdAt: string;
  /** 更新时间（ISO 字符串）。 */
  updatedAt: string;
};

/** 数据库行类型（snake_case），对应 `cct_model_config` 表的列结构。 */
type ModelConfigRow = {
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
  user_id: string | null;
};

/**
 * 将数据库行（snake_case）转换为应用层模型配置（camelCase）。
 * name 字段数据库无对应列，使用 id 作为 fallback。
 */
// 数据库行 → camelCase（name 用 id 作为 fallback，因数据库无 name 字段）
function toModelConfig(row: ModelConfigRow): ModelConfig {
  return {
    id: row.id,
    name: row.id,
    provider: row.provider,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    capabilities: row.capabilities,
    reasoningEffort: row.reasoning_effort,
    isDefault: row.is_default,
    isTitleModel: row.is_title_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 查询指定用户的全部模型配置（客户端可调用版本）。
 * 使用 server client（受 RLS 保护），仅查询当前用户自己的模型；
 * 返回前对 api_key 脱敏（置为 null），避免敏感信息泄露到客户端。
 *
 * @param userId 用户 id
 * @returns 脱敏后的模型配置列表（按创建时间升序）
 */
// 客户端可调用，返回时脱敏 api_key
// 使用 server client（受 RLS 保护），仅查询当前用户自己的模型
export async function getAllModelConfigsForClient(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cct_model_config")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }
  // 脱敏：移除 api_key
  return (data as ModelConfigRow[]).map((row) => {
    const cfg = toModelConfig(row);
    cfg.apiKey = null;
    return cfg;
  });
}

/**
 * 查询指定用户的全部模型配置（服务端 AI 链路使用，不脱敏）。
 * 使用 server client（受 RLS 保护），仅查询当前用户自己的模型。
 *
 * @param userId 用户 id
 * @returns 模型配置列表（按创建时间升序），包含 api_key
 */
// 服务端 AI 链路使用，不脱敏
// 使用 server client（受 RLS 保护），仅查询当前用户自己的模型
export async function getAllModelConfigs(
  userId: string
): Promise<ModelConfig[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cct_model_config")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }
  return (data as ModelConfigRow[]).map(toModelConfig);
}

/**
 * 根据 id 查询单个模型配置。
 *
 * @param userId 用户 id（用于 RLS 隔离）
 * @param id 模型 id
 * @returns 模型配置；不存在时返回 null
 */
export async function getModelConfigById(
  userId: string,
  id: string
): Promise<ModelConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cct_model_config")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .single();

  if (error) {
    // PGRST116 表示未命中行
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    // 其他错误抛出
    throw error;
  }
  return toModelConfig(data as ModelConfigRow);
}

/**
 * 查询用户的默认模型配置（is_default = true）。
 *
 * @param userId 用户 id
 * @returns 默认模型配置；未配置时返回 null
 */
export async function getDefaultModelConfig(
  userId: string
): Promise<ModelConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cct_model_config")
    .select("*")
    .eq("user_id", userId)
    .eq("is_default", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    // 其他错误抛出
    throw error;
  }
  return toModelConfig(data as ModelConfigRow);
}

/**
 * 查询用户的标题生成模型配置（is_title_model = true）。
 *
 * @param userId 用户 id
 * @returns 标题模型配置；未配置时返回 null
 */
export async function getTitleModelConfig(
  userId: string
): Promise<ModelConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cct_model_config")
    .select("*")
    .eq("user_id", userId)
    .eq("is_title_model", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    // 其他错误抛出
    throw error;
  }
  return toModelConfig(data as ModelConfigRow);
}

/**
 * 创建一条新的模型配置。
 * 入参为 camelCase，写入数据库前转换为 snake_case；name 字段不持久化（数据库无此列）。
 *
 * @param userId 用户 id
 * @param config 模型配置入参
 * @returns 创建后的模型配置
 */
export async function createModelConfig(
  userId: string,
  config: {
    id: string;
    name?: string;
    provider: string;
    baseUrl?: string;
    apiKey?: string;
    capabilities?: any;
    reasoningEffort?: string;
    isDefault?: boolean;
    isTitleModel?: boolean;
  }
) {
  const supabase = await createClient();
  // camelCase → snake_case（name 字段不存储，数据库无此字段）
  const {
    name: _name,
    baseUrl,
    apiKey,
    reasoningEffort,
    isDefault,
    isTitleModel,
    ...rest
  } = config;
  const row = {
    ...rest,
    base_url: baseUrl,
    api_key: apiKey,
    reasoning_effort: reasoningEffort,
    is_default: isDefault,
    is_title_model: isTitleModel,
    user_id: userId,
  };
  const { data, error } = await supabase
    .from("cct_model_config")
    .insert(row)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return toModelConfig(data as ModelConfigRow);
}

/**
 * 更新指定的模型配置（部分字段）。
 * 仅更新传入的字段；同时显式校验 user_id 归属，与 RLS 形成双保险。
 *
 * @param userId 用户 id（用于归属校验）
 * @param id 模型 id
 * @param changes 待更新字段（camelCase）
 * @returns 更新后的模型配置
 */
export async function updateModelConfig(
  userId: string,
  id: string,
  changes: Partial<{
    name: string;
    provider: string;
    baseUrl: string;
    apiKey: string;
    capabilities: any;
    reasoningEffort: string;
    isDefault: boolean;
    isTitleModel: boolean;
  }>
) {
  const supabase = await createClient();
  // camelCase → snake_case（name 字段不存储，数据库无此字段）
  const {
    name: _name,
    baseUrl,
    apiKey,
    reasoningEffort,
    isDefault,
    isTitleModel,
    ...rest
  } = changes;
  const row: Record<string, any> = {
    ...rest,
    updated_at: new Date().toISOString(),
  };
  // 仅在字段被显式传入时才写入对应列，避免误覆盖为 undefined
  if (baseUrl !== undefined) {
    row.base_url = baseUrl;
  }
  if (apiKey !== undefined) {
    row.api_key = apiKey;
  }
  if (reasoningEffort !== undefined) {
    row.reasoning_effort = reasoningEffort;
  }
  if (isDefault !== undefined) {
    row.is_default = isDefault;
  }
  if (isTitleModel !== undefined) {
    row.is_title_model = isTitleModel;
  }

  // 同时校验 user_id 归属（RLS 也会校验，这里显式 .eq 双保险）
  const { data, error } = await supabase
    .from("cct_model_config")
    .update(row as Database["public"]["Tables"]["cct_model_config"]["Update"])
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return toModelConfig(data as ModelConfigRow);
}

/**
 * 删除指定的模型配置。
 * 同时显式校验 user_id 归属，与 RLS 形成双保险。
 *
 * @param userId 用户 id（用于归属校验）
 * @param id 模型 id
 */
export async function deleteModelConfig(userId: string, id: string) {
  const supabase = await createClient();
  // 同时校验 user_id 归属（RLS 也会校验，这里显式 .eq 双保险）
  const { error } = await supabase
    .from("cct_model_config")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
}
