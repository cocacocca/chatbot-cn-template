/**
 * @file Researcher Subagent
 * @description 研究 ambiguous 问题，收集证据后返回结构化报告
 * @module agent/subagents/researcher
 */

import { defineAgent } from "eve";

/**
 * Researcher Subagent
 *
 * 专门用于研究不明确的问题。parent agent 通过内置 `agent` 工具委托任务。
 * 拥有独立的 instructions、tools 和 skills，不继承 root agent 的配置。
 */
export default defineAgent({
  description:
    "Investigate ambiguous questions before the parent agent responds. Use for research tasks that require gathering evidence.",
  model: "anthropic/claude-sonnet-4-20250514",
});
