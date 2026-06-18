/** @file 统一错误体系：错误类型、错误码、可见性策略与 ChatbotError 异常类 */

/**
 * 错误类型
 * - bad_request: 请求参数错误
 * - unauthorized: 未认证
 * - forbidden: 无权限
 * - not_found: 资源不存在
 * - rate_limit: 触发限流
 * - offline: 离线
 */
export type ErrorType =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "offline";

/**
 * 错误发生的界面/模块
 * - chat: 聊天
 * - auth: 认证
 * - api: 接口
 * - stream: 流式
 * - database: 数据库
 * - history: 历史
 * - document: 文档
 * - suggestions: 建议
 */
export type Surface =
  | "chat"
  | "auth"
  | "api"
  | "stream"
  | "database"
  | "history"
  | "document"
  | "suggestions";

/** 错误码：`错误类型:界面` 的组合字符串 */
export type ErrorCode = `${ErrorType}:${Surface}`;

/**
 * 错误可见性
 * - response: 返回给前端
 * - log: 仅记录日志
 * - none: 既不返回也不记录
 */
export type ErrorVisibility = "response" | "log" | "none";

/** 按界面配置错误可见性：database 仅记录日志，其余界面返回给前端 */
export const visibilityBySurface: Record<Surface, ErrorVisibility> = {
  database: "log",
  chat: "response",
  auth: "response",
  stream: "response",
  api: "response",
  history: "response",
  document: "response",
  suggestions: "response",
};

/**
 * 应用统一错误类
 * 携带错误类型、发生界面、HTTP 状态码与可读消息，支持转换为 JSON 响应
 */
export class ChatbotError extends Error {
  type: ErrorType;
  surface: Surface;
  statusCode: number;

  /**
   * @param errorCode 错误码（`类型:界面`）
   * @param cause 原始原因
   */
  constructor(errorCode: ErrorCode, cause?: string) {
    super();

    const [type, surface] = errorCode.split(":");

    this.type = type as ErrorType;
    this.cause = cause;
    this.surface = surface as Surface;
    this.message = getMessageByErrorCode(errorCode);
    this.statusCode = getStatusCodeByType(this.type);
  }

  /**
   * 转换为 HTTP 响应
   * 按可见性策略决定是否将错误细节返回前端；仅记录日志的错误返回通用提示
   */
  toResponse() {
    const code: ErrorCode = `${this.type}:${this.surface}`;
    const visibility = visibilityBySurface[this.surface];

    const { message, cause, statusCode } = this;

    if (visibility === "log") {
      console.error({
        code,
        message,
        cause,
      });

      return Response.json(
        { code: "", message: "Something went wrong. Please try again later." },
        { status: statusCode }
      );
    }

    return Response.json({ code, message, cause }, { status: statusCode });
  }
}

/**
 * 根据错误码返回面向用户的可读消息
 * @param errorCode 错误码
 * @returns 可读消息字符串
 */
export function getMessageByErrorCode(errorCode: ErrorCode): string {
  if (errorCode.includes("database")) {
    return "An error occurred while executing a database query.";
  }

  switch (errorCode) {
    case "bad_request:api":
      return "The request couldn't be processed. Please check your input and try again.";

    case "unauthorized:auth":
      return "You need to sign in before continuing.";
    case "forbidden:auth":
      return "Your account does not have access to this feature.";

    case "rate_limit:chat":
      return "You've reached the message limit. Come back in 1 hour to continue chatting.";
    case "not_found:chat":
      return "The requested chat was not found. Please check the chat ID and try again.";
    case "forbidden:chat":
      return "This chat belongs to another user. Please check the chat ID and try again.";
    case "unauthorized:chat":
      return "You need to sign in to view this chat. Please sign in and try again.";
    case "offline:chat":
      return "We're having trouble sending your message. Please check your internet connection and try again.";

    case "not_found:document":
      return "The requested document was not found. Please check the document ID and try again.";
    case "forbidden:document":
      return "This document belongs to another user. Please check the document ID and try again.";
    case "unauthorized:document":
      return "You need to sign in to view this document. Please sign in and try again.";
    case "bad_request:document":
      return "The request to create or update the document was invalid. Please check your input and try again.";

    default:
      return "Something went wrong. Please try again later.";
  }
}

/**
 * 根据错误类型映射 HTTP 状态码
 * @param type 错误类型
 * @returns HTTP 状态码
 */
function getStatusCodeByType(type: ErrorType) {
  switch (type) {
    case "bad_request":
      return 400;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "rate_limit":
      return 429;
    case "offline":
      return 503;
    default:
      return 500;
  }
}
