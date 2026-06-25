/**
 * @file OpenAPI Connection 示例
 * @description 展示如何连接 OpenAPI 服务，实际使用时需要配置对应的 API Token
 * @module agent/connections/openapi-example
 */

import { defineOpenAPIConnection } from "eve/connections";

/**
 * OpenAPI Connection 示例
 *
 * 连接 OpenAPI 服务，自动发现所有操作。
 * 模型通过 connection_search 发现工具，通过 openapi-example__<operationId> 调用。
 *
 * 注意：这是一个示例文件，实际使用时：
 * 1. 配置对应的环境变量
 * 2. 将文件重命名为实际的 service 名称
 * 3. 根据需要配置 operations 过滤器
 */
export default defineOpenAPIConnection({
  spec: "https://petstore3.swagger.io/api/v3/openapi.json",
  description: "Pet store inventory and orders. Example OpenAPI connection.",
  baseUrl: "https://petstore3.swagger.io",
  auth: {
    getToken: async () => ({
      token: process.env.PETSTORE_TOKEN ?? "",
    }),
  },
});
