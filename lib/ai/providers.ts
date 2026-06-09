import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { getModelConfigById, getTitleModelConfig } from "@/lib/db/queries";

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
  return client.languageModel(config.id);
}

export async function getTitleModel() {
  const config = await getTitleModelConfig();

  if (!config) {
    throw new Error(
      "No title model configured. Set a model as title model in Settings (/settings)."
    );
  }

  const client = createClientForModel(config.baseUrl, config.apiKey);
  return client.languageModel(config.id);
}
