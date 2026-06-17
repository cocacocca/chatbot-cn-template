export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const suggestions = [
  "使用 Next.js 有哪些优势？",
  "编写代码演示 Dijkstra 算法",
  "帮我写一篇关于硅谷的文章",
  "今天北京天气怎么样？",
];
