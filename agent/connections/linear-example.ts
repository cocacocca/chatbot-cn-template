/**
 * @file Linear MCP Connection 示例
 * @description 展示如何连接 Linear MCP 服务，实际使用时需要配置 LINEAR_API_TOKEN 环境变量
 * @module agent/connections/linear-example
 */

import { defineMcpClientConnection } from "eve/connections";

/**
 * Linear MCP Connection
 *
 * 连接 Linear workspace，提供 issues、projects、cycles 等工具。
 * 模型通过 connection_search 发现工具，通过 linear-example__<tool> 调用。
 *
 * 注意：这是一个示例文件，实际使用时：
 * 1. 配置 LINEAR_API_TOKEN 环境变量
 * 2. 将文件重命名为 linear.ts（移除 -example 后缀）
 * 3. 根据需要配置 tools 过滤器和 approval 机制
 */
export default defineMcpClientConnection({
  url: "https://mcp.linear.app/sse",
  description:
    "Linear workspace: issues, projects, cycles, and comments. Use for project management tasks.",
  auth: {
    getToken: async () => ({
      token: process.env.LINEAR_API_TOKEN ?? "",
    }),
  },
});
