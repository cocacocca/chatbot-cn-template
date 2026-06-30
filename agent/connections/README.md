# Connections

EVE 框架的 Connections 模块用于连接外部 MCP 或 OpenAPI 服务。

## 添加新 Connection

1. 在此目录下创建 `.ts` 文件（文件名即 connection 名）
2. 使用 `defineMcpClientConnection` 或 `defineOpenAPIConnection` 定义连接
3. EVE 框架自动发现此目录下的文件

## 示例

参见 `linear-example.ts` 和 `openapi-example.ts`

## 注意

- 实际使用时需要配置对应的环境变量（API Token 等）
- 可通过前端页面管理（/admin/connections）增删改查
