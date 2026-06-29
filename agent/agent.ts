/**
 * @file EVE Agent Runtime 配置
 * @description 使用 EVE 框架的 defineAgent 配置 Agent 的 model、compaction 等参数。
 *
 *   model 从数据库全局默认模型解析（数据库为唯一真实源），失败时 fallback 到
 *   .env.local 的 OPENAI_*。详见 agent/lib/model.ts。
 *
 *   使用顶层 await（ESM）让 getEveModel() 异步查库后再绑定模型到 EVE。
 *   注意：EVE 主对话模型是进程内全局唯一、启动时绑定的，无法按用户切换。
 *   在 /settings 修改默认模型后需重启 dev server 让本模块重新加载绑定。
 * @module agent/agent
 */

import { defineAgent } from "eve";
import { getEveModel } from "./lib/model";

/**
 * EVE Agent 默认配置
 * @description model 始终是 provider 实例（external 路由），直连 OpenAI 兼容端点。
 *   modelContextWindowTokens 显式声明上下文窗口，避免 EVE 远程查询模型元数据。
 */
export default defineAgent({
  // 顶层 await：模块加载时异步查库解析模型，再静态绑定到 EVE
  model: await getEveModel(),
  modelContextWindowTokens: 128_000, // 显式声明上下文窗口，跳过远程元数据查询
  compaction: {
    thresholdPercent: 0.75,
  },
});
