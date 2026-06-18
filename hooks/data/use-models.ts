/** @file 模型列表 Hook，基于 SWR 拉取可用模型配置并转换为 ChatModel */
"use client";

import useSWR from "swr";
import type { ChatModel } from "@/lib/ai/model-types";
import { fetcher } from "@/lib/utils";

/** 单个模型的原始配置，包含能力声明与默认/标题模型标记 */
export type ModelConfig = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string | null;
  apiKey: string | null;
  capabilities: { tools: boolean; vision: boolean; reasoning: boolean };
  reasoningEffort: string | null;
  isDefault: boolean;
  isTitleModel: boolean;
};

/** 模型列表接口响应，包含模型数组与按 ID 索引的能力映射 */
export type ModelsResponse = {
  models: ModelConfig[];
  capabilities: Record<
    string,
    { tools: boolean; vision: boolean; reasoning: boolean }
  >;
};

/** 模型列表 SWR key，固定指向 `/api/models` */
export const MODELS_SWR_KEY = "/api/models";

/**
 * 将原始模型配置转换为前端使用的 ChatModel 结构
 *
 * @param configs 原始模型配置数组
 * @returns 转换后的 ChatModel 数组
 */
function toChatModels(configs: ModelConfig[]): ChatModel[] {
  return configs.map((c) => ({
    id: c.id,
    name: c.name,
    provider: c.provider,
    description: `${c.name} by ${c.provider}`,
    baseUrl: c.baseUrl,
    reasoningEffort:
      (c.reasoningEffort as ChatModel["reasoningEffort"]) ?? undefined,
    capabilities: c.capabilities,
  }));
}

/**
 * 模型列表 Hook
 *
 * 拉取后端可用模型配置，同时返回转换后的 ChatModel 列表、原始配置、
 * 能力映射以及加载/错误状态。
 *
 * @returns 模型列表、原始配置、能力映射、加载状态、错误与 mutate 方法
 */
export function useModels() {
  const { data, error, isLoading, mutate } = useSWR<ModelsResponse>(
    MODELS_SWR_KEY,
    fetcher,
    { revalidateOnFocus: false }
  );

  const rawModels = data?.models ?? [];

  return {
    models: toChatModels(rawModels),
    rawModels,
    capabilities: data?.capabilities ?? {},
    isLoading,
    error,
    mutate,
  };
}
