/**
 * @file EVE Agent Runtime 配置
 * @description 使用 EVE 框架的 defineAgent 配置 Agent 的 model、compaction 等参数
 * @module agent/agent
 */

import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";

/**
 * 获取模型配置
 * @description 从环境变量获取 OpenAI API 配置，未来可扩展为数据库三级 fallback
 * @returns OpenAI chat model 实例
 */
function getModelConfig() {
  const envApiKey = process.env.OPENAI_API_KEY;
  const envBaseUrl = process.env.OPENAI_BASE_URL;
  const envModelId = process.env.OPENAI_BASE_MODEL;

  if (!envApiKey || !envModelId) {
    throw new Error(
      "No model configured. Set OPENAI_API_KEY and OPENAI_BASE_MODEL environment variables."
    );
  }

  const client = createOpenAI({
    apiKey: envApiKey,
    baseURL: envBaseUrl,
  });

  return client.chat(envModelId);
}

/**
 * EVE Agent 默认配置
 * @description 配置单 model、compaction threshold = 0.75
 */
export default defineAgent({
  model: getModelConfig(),
  compaction: {
    thresholdPercent: 0.75, // 默认 0.9，降低为 0.75 以更早压缩
  },
});
