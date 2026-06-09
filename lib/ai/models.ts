import "server-only";

import {
  getAllModelConfigs,
  getDefaultModelConfig,
  getTitleModelConfig,
} from "@/lib/db/queries";

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

export async function getChatModels(): Promise<ChatModel[]> {
  const configs = await getAllModelConfigs();
  return configs.map((c) => ({
    id: c.id,
    name: c.name,
    provider: c.provider,
    description: `${c.name} by ${c.provider}`,
    baseUrl: c.baseUrl,
    reasoningEffort: (c.reasoningEffort as ChatModel["reasoningEffort"]) ?? undefined,
    capabilities: c.capabilities as ModelCapabilities,
  }));
}

export async function getDefaultModelId(): Promise<string> {
  const config = await getDefaultModelConfig();
  return config?.id ?? "";
}

export async function getTitleModelId(): Promise<string> {
  const config = await getTitleModelConfig();
  return config?.id ?? "";
}

export async function getModelCapabilitiesMap(): Promise<
  Record<string, ModelCapabilities>
> {
  const models = await getChatModels();
  return Object.fromEntries(models.map((m) => [m.id, m.capabilities]));
}

export async function isAllowedModelId(modelId: string): Promise<boolean> {
  const models = await getChatModels();
  return models.some((m) => m.id === modelId);
}
