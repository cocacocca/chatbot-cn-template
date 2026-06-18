/** @file 聊天模型（ChatModel）及其能力（capabilities）的类型定义，供模型相关模块共享。 */

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
  /** 模型唯一标识（与 provider 配合定位具体模型）。 */
  id: string;
  /** 模型展示名称。 */
  name: string;
  /** 模型提供方（如 openai、anthropic 等）。 */
  provider: string;
  /** 模型描述文本。 */
  description: string;
  /** 可选的自定义 API 基础地址；为 null 表示使用 provider 默认地址。 */
  baseUrl?: string | null;
  /** 可选的推理强度等级，none 表示不启用推理。 */
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  /** 模型能力集合。 */
  capabilities: ModelCapabilities;
};
