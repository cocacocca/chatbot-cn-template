"use client";

import useSWR from "swr";
import type { ChatModel } from "@/lib/ai/model-types";
import { fetcher } from "@/lib/utils";

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

export type ModelsResponse = {
  models: ModelConfig[];
  capabilities: Record<
    string,
    { tools: boolean; vision: boolean; reasoning: boolean }
  >;
};

export const MODELS_SWR_KEY = "/api/models";

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
