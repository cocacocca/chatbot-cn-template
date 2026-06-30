/**
 * @file Create Document Eval
 * @description 测试 Artifact 创建功能，验证工具调用和文档生成
 * @module evals/artifacts/create-document
 */

import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

/**
 * Create Document Eval
 *
 * 验证 Agent 能正确调用 create-document 工具并创建文档。
 */
export default defineEval({
  description: "Verify artifact creation tool usage.",
  async test(t) {
    await t.send("Write a short essay about AI trends");
    t.calledTool("create-document");
    t.check(t.reply, includes("document"));
  },
});
