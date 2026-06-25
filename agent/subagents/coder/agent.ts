/**
 * @file Coder Subagent
 * @description 代码编写专家，遵循最佳实践和设计模式
 * @module agent/subagents/coder
 */

import { defineAgent } from "eve";

/**
 * Coder Subagent
 *
 * 专门用于编写代码。遵循最佳实践、设计模式，输出干净可维护的代码。
 */
export default defineAgent({
  description:
    "Write, review, and debug code following best practices. Use for implementation tasks that require clean, maintainable code.",
  model: "anthropic/claude-sonnet-4-20250514",
});
