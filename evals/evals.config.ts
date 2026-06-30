/**
 * @file EVE Evals 配置
 * @description 定义评估测试的全局配置，包括 judge model 和并发设置
 * @module evals/config
 */

import { createOpenAI } from "@ai-sdk/openai";
import { defineEvalConfig } from "eve/evals";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

/**
 * Eval Config
 *
 * 配置评估测试的 judge model 和并发设置。
 * - judge: 使用 gpt-4o-mini 作为评分模型
 * - maxConcurrency: 最大并发数 5
 * - timeoutMs: 超时时间 60 秒
 */
export default defineEvalConfig({
  judge: { model: openai.chat("gpt-4o-mini") },
  maxConcurrency: 5,
  timeoutMs: 60_000,
});
