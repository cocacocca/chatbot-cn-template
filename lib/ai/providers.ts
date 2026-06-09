import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import {
  getAllModelConfigs,
  getModelConfigById,
  getTitleModelConfig,
} from "@/lib/db/queries";

function createClientForModel(
  baseUrl: string | null | undefined,
  apiKey: string | null | undefined
) {
  if (!apiKey) {
    throw new Error(
      "API Key is required. Configure it per-model in Settings (/settings)."
    );
  }

  return createOpenAI({
    apiKey,
    ...(baseUrl && { baseURL: baseUrl }),
  });
}

export async function getLanguageModel(modelId: string) {
  const config = await getModelConfigById({ id: modelId });

  if (!config) {
    throw new Error(
      `Model "${modelId}" not found in database. Add it in Settings (/settings).`
    );
  }

  const client = createClientForModel(config.baseUrl, config.apiKey);
  return client.chat(config.id);
}

export async function getTitleModel() {
  const config = await getTitleModelConfig();

  // fallback: 没有专门配置 title model 时，使用第一个已配置的模型
  const fallbackConfig = config ?? (await getAllModelConfigs())[0];

  if (!fallbackConfig) {
    throw new Error(
      "No models configured. Add a model in Settings (/settings)."
    );
  }

  const client = createClientForModel(
    fallbackConfig.baseUrl,
    fallbackConfig.apiKey
  );
  return client.chat(fallbackConfig.id);
}
