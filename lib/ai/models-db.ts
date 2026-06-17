import "server-only";
import { createAdminClient } from '@/lib/supabase/admin';

type ModelConfig = {
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

// 客户端可调用，返回时脱敏 api_key
export async function getAllModelConfigsForClient() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  // 脱敏：移除 api_key
  return data.map(({ api_key, ...rest }) => rest);
}

// 服务端 AI 链路使用，不脱敏
export async function getAllModelConfigs(): Promise<ModelConfig[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as ModelConfig[];
}

export async function getModelConfigById(id: string): Promise<ModelConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as ModelConfig;
}

export async function getDefaultModelConfig(): Promise<ModelConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .select('*')
    .eq('is_default', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as ModelConfig;
}

export async function getTitleModelConfig(): Promise<ModelConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .select('*')
    .eq('is_title_model', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as ModelConfig;
}

export async function createModelConfig(config: {
  id: string;
  provider: string;
  base_url?: string;
  api_key?: string;
  capabilities?: any;
  reasoning_effort?: string;
  is_default?: boolean;
  is_title_model?: boolean;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .insert(config)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateModelConfig(
  id: string,
  changes: Partial<{
    provider: string;
    base_url: string;
    api_key: string;
    capabilities: any;
    reasoning_effort: string;
    is_default: boolean;
    is_title_model: boolean;
  }>
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('model_config')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteModelConfig(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('model_config').delete().eq('id', id);
  if (error) throw error;
}
