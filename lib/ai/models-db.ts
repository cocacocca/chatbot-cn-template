import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type ModelConfig = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string | null;
  apiKey: string | null;
  capabilities: any;
  reasoningEffort: string | null;
  isDefault: boolean;
  isTitleModel: boolean;
  createdAt: string;
  updatedAt: string;
};

// 数据库行类型（snake_case）
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
};

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

// 客户端可调用，返回时脱敏 api_key
export async function getAllModelConfigsForClient() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cct_model_config")
    .select("*")
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

// 服务端 AI 链路使用，不脱敏
export async function getAllModelConfigs(): Promise<ModelConfig[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cct_model_config")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }
  return (data as ModelConfigRow[]).map(toModelConfig);
}

export async function getModelConfigById(
  id: string
): Promise<ModelConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cct_model_config")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    // 其他错误抛出
    throw error;
  }
  return toModelConfig(data as ModelConfigRow);
}

export async function getDefaultModelConfig(): Promise<ModelConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cct_model_config")
    .select("*")
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

export async function getTitleModelConfig(): Promise<ModelConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cct_model_config")
    .select("*")
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

export async function createModelConfig(config: {
  id: string;
  name?: string;
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  capabilities?: any;
  reasoningEffort?: string;
  isDefault?: boolean;
  isTitleModel?: boolean;
}) {
  const supabase = createAdminClient();
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

export async function updateModelConfig(
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
  const supabase = createAdminClient();
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

  const { data, error } = await supabase
    .from("cct_model_config")
    .update(row as Database["public"]["Tables"]["cct_model_config"]["Update"])
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return toModelConfig(data as ModelConfigRow);
}

export async function deleteModelConfig(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("cct_model_config")
    .delete()
    .eq("id", id);
  if (error) {
    throw error;
  }
}
