/** @file 全局常量：运行环境标志与默认建议示例 */

/** 是否为生产环境 */
export const isProductionEnvironment = process.env.NODE_ENV === "production";
/** 是否为开发环境 */
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
/** 是否为 Playwright 测试环境（由相关环境变量判定） */
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

/** 首页默认展示的建议示例问题 */
export const suggestions = [
  "使用 Next.js 有哪些优势？",
  "编写代码演示 Dijkstra 算法",
  "帮我写一篇关于硅谷的文章",
  "今天北京天气怎么样？",
];
