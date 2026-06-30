/**
 * @file Researcher Subagent
 * @description 研究 ambiguous 问题，收集证据后返回结构化报告
 * @module agent/subagents/researcher
 */

import { defineAgent } from "eve";
import { getEveModel } from "../../lib/model";

/**
 * Researcher Subagent
 *
 * 专门用于研究不明确的问题。parent agent 通过内置 `agent` 工具委托任务。
 * 拥有独立的 description 与 tools（tools 由 tools/ 子目录按约定自动发现），
 * 不继承 root agent 的配置。
 * model 通过同一工厂函数 getEveModel() 创建（配置与 root agent 一致，
 * external 路由直连外部 API），不经过 AI Gateway。
 */
export default defineAgent({
  description:
    "Investigate ambiguous questions before the parent agent responds. Use for research tasks that require gathering evidence.",
  // 顶层 await：与 root agent 一致，从数据库解析模型
  model: await getEveModel(),
  modelContextWindowTokens: 128_000, // 显式声明上下文窗口，跳过远程元数据查询
});
