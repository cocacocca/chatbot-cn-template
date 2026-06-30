/**
 * @file Coder Subagent
 * @description 代码编写专家，遵循最佳实践和设计模式
 * @module agent/subagents/coder
 */

import { defineAgent } from "eve";
import { getEveModel } from "../../lib/model";

/**
 * Coder Subagent
 *
 * 专门用于编写代码。遵循最佳实践、设计模式，输出干净可维护的代码。
 * model 复用 root agent 的 OpenAI 兼容实例（external 路由，直连外部 API），
 * 不经过 AI Gateway。
 */
export default defineAgent({
  description:
    "Write, review, and debug code following best practices. Use for implementation tasks that require clean, maintainable code.",
  // 顶层 await：与 root agent 一致，从数据库解析模型
  model: await getEveModel(),
  modelContextWindowTokens: 128_000, // 显式声明上下文窗口，跳过远程元数据查询
});
