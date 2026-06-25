/**
 * @file Smoke Eval
 * @description 基本消息覆盖测试，验证 Agent 能正常回复
 * @module evals/smoke
 */

import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

/**
 * Smoke Eval
 *
 * 基本冒烟测试，验证 Agent 能正常回复消息。
 */
export default defineEval({
  description:
    "Basic message coverage - verify agent can respond to greetings.",
  async test(t) {
    await t.send("Hello, how are you?");
    t.completed();
    t.check(t.reply, includes("hello"));
  },
});
