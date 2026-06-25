/**
 * @file Weather Forecast Eval
 * @description 测试天气查询功能，验证工具调用和回复内容
 * @module evals/weather/forecast
 */

import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

/**
 * Weather Forecast Eval
 *
 * 验证 Agent 能正确调用 get-weather 工具并返回天气信息。
 */
export default defineEval({
  description: "Verify weather tool usage and response content.",
  async test(t) {
    await t.send("What is the weather in Brooklyn?");
    t.completed();
    t.calledTool("get-weather");
    t.check(t.reply, includes("Sunny"));
  },
});
