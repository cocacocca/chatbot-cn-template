/**
 * @file EVE Instrumentation 配置
 * @description 配置 OpenTelemetry 遥测导出，追踪 Agent 的模型调用和工具执行
 * @module agent/instrumentation
 */

import { defineInstrumentation } from "eve/instrumentation";

/**
 * Instrumentation 配置
 *
 * 配置 OpenTelemetry 遥测导出，用于调试和监控 Agent 运行时行为。
 * - recordInputs: 记录完整消息历史（默认 true）
 * - recordOutputs: 记录模型输出（默认 true）
 *
 * 启用遥测导出（setup 回调）的前置条件：
 * 1. 安装 `@vercel/otel` 包（提供 registerOTel）
 * 2. 安装对应的 trace exporter（如 `@braintrust/otel` 提供 BraintrustExporter，
 *    或使用 `@opentelemetry/sdk-trace-base` 的 ConsoleSpanExporter 做本地调试）
 * 3. 配置对应 exporter 所需的 API key 环境变量
 * 4. 取消下方 setup 回调的注释并按需替换 exporter 实现
 *
 * 当 setup 缺省时，EVE 仍会启用 AI SDK 的 telemetry span 生成，
 * 只是 span 不会被导出到外部后端，仅保留在内存中用于内部调试。
 */
export default defineInstrumentation({
  recordInputs: true,
  recordOutputs: true,
  // TODO: 安装 @vercel/otel 与 exporter 后取消注释，并替换为真实 exporter
  // setup: ({ agentName }) => {
  //   registerOTel({
  //     serviceName: agentName,
  //     traceExporter: new BraintrustExporter({
  //       parent: `project_name:${agentName}`,
  //       filterAISpans: true,
  //     }),
  //   });
  // },
});
