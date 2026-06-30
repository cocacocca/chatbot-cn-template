/**
 * @file EVE React shim
 * @description 包裹 eve/react 导出，添加 "use client" 指令以解决 Turbopack 模块边界问题。
 *   eve/react 模块本身没有 "use client" 指令，导致 Turbopack 将其识别为服务端模块。
 *   此 shim 文件确保 Turbopack 正确将 eve/react 标记为客户端模块。
 * @module lib/eve/react
 */
"use client";

export type {
  ClientInputRespondedEvent,
  ClientMessageFailedEvent,
  ClientMessageSubmittedEvent,
  EveAgentReducer,
  EveAgentReducerEvent,
  EveDynamicToolPart,
  EveMessage,
  EveMessageData,
  EveMessageInputRequest,
  EveMessageMetadata,
  EveMessagePart,
  EveMessageToolMetadata,
  PrepareSend,
  UseEveAgentHelpers,
  UseEveAgentOptions,
  UseEveAgentSnapshot,
  UseEveAgentStatus,
} from "eve/react";
export { defaultMessageReducer, useEveAgent } from "eve/react";
