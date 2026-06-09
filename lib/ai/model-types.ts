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
