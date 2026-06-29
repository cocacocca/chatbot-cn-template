/**
 * @file Connections 管理 API 路由
 * @description 提供 Connections 的增删改查接口，操作 agent/connections/ 目录下的文件
 * @module api/admin/connections
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { requireAdmin } from "@/lib/auth/admin-guard";

/** Connections 目录的绝对路径 */
const CONNECTIONS_DIR = join(process.cwd(), "agent", "connections");

/** Connection 类型 */
type ConnectionType = "mcp" | "openapi";

/** GET 返回的单个 connection 项 */
type ConnectionItem = {
  id: string;
  type: ConnectionType;
  path: string;
  content: string;
};

/** POST 请求体 */
type CreateConnectionRequest = {
  id: string;
  type: ConnectionType;
  url?: string;
  description: string;
  tokenEnvVar: string;
};

/** PUT 请求体 */
type UpdateConnectionRequest = {
  id: string;
  content: string;
};

/** 文件名安全校验：仅允许字母、数字、连字符、下划线 */
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** 环境变量名安全校验：字母或下划线开头，仅含字母、数字、下划线 */
const ENV_VAR_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * 从文件内容检测 connection 类型
 * 通过查找 defineMcpClientConnection / defineOpenAPIConnection 关键字判定
 * @param content 文件内容
 * @returns connection 类型，默认 mcp
 */
function detectType(content: string): ConnectionType {
  if (content.includes("defineOpenAPIConnection")) {
    return "openapi";
  }
  return "mcp";
}

/**
 * 生成 MCP connection 的 TypeScript 代码模板
 * 字符串字面量使用 JSON.stringify 保证转义安全
 * @param args 模板参数（id、url、description、tokenEnvVar）
 * @returns 生成的 TypeScript 代码字符串
 */
function buildMcpTemplate(args: {
  id: string;
  url: string;
  description: string;
  tokenEnvVar: string;
}): string {
  const { id, url, description, tokenEnvVar } = args;
  const urlLiteral = JSON.stringify(url);
  const descLiteral = JSON.stringify(description);
  return `/**
 * @file ${id} MCP Connection
 * @description ${description}
 * @module agent/connections/${id}
 */

import { defineMcpClientConnection } from "eve/connections";

/**
 * ${id} MCP Connection
 *
 * ${description}
 *
 * 注意：使用前请确保已配置环境变量 ${tokenEnvVar}
 */
export default defineMcpClientConnection({
  url: ${urlLiteral},
  description: ${descLiteral},
  auth: {
    getToken: async () => ({
      token: process.env.${tokenEnvVar} ?? "",
    }),
  },
});
`;
}

/**
 * 生成 OpenAPI connection 的 TypeScript 代码模板
 * baseUrl 从 spec url 推导 origin（合理推断，避免增加额外表单字段）
 * @param args 模板参数（id、specUrl、baseUrl、description、tokenEnvVar）
 * @returns 生成的 TypeScript 代码字符串
 */
function buildOpenApiTemplate(args: {
  id: string;
  specUrl: string;
  baseUrl: string;
  description: string;
  tokenEnvVar: string;
}): string {
  const { id, specUrl, baseUrl, description, tokenEnvVar } = args;
  const specLiteral = JSON.stringify(specUrl);
  const descLiteral = JSON.stringify(description);
  const baseUrlLiteral = JSON.stringify(baseUrl);
  return `/**
 * @file ${id} OpenAPI Connection
 * @description ${description}
 * @module agent/connections/${id}
 */

import { defineOpenAPIConnection } from "eve/connections";

/**
 * ${id} OpenAPI Connection
 *
 * ${description}
 *
 * 注意：使用前请确保已配置环境变量 ${tokenEnvVar}
 */
export default defineOpenAPIConnection({
  spec: ${specLiteral},
  description: ${descLiteral},
  baseUrl: ${baseUrlLiteral},
  auth: {
    getToken: async () => ({
      token: process.env.${tokenEnvVar} ?? "",
    }),
  },
});
`;
}

/**
 * GET: 读取 connections 目录，返回所有 .ts connection 文件
 * 目录不存在时返回空列表（首次使用时 agent/connections 可能尚未创建）
 * @returns 200 { connections: ConnectionItem[] } / 401 未授权 / 500 服务器错误
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 目录不存在时返回空列表
    try {
      await fs.access(CONNECTIONS_DIR);
    } catch {
      return Response.json({ connections: [] });
    }

    const entries = await fs.readdir(CONNECTIONS_DIR, { withFileTypes: true });
    const fileEntries = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith(".ts")
    );

    // 使用 Promise.all 并发读取，避免 await in loop
    const connections = await Promise.all(
      fileEntries.map(async (entry): Promise<ConnectionItem> => {
        const fullPath = join(CONNECTIONS_DIR, entry.name);
        const content = await fs.readFile(fullPath, "utf-8");
        const id = entry.name.slice(0, -3); // 移除 .ts 扩展名
        return {
          id,
          type: detectType(content),
          path: `agent/connections/${entry.name}`,
          content,
        };
      })
    );

    return Response.json({ connections });
  } catch (_error) {
    return Response.json(
      { error: "Failed to read connections" },
      { status: 500 }
    );
  }
}

/**
 * POST: 创建新 connection 文件
 * 根据 type 生成对应的 TypeScript 代码模板并写入 agent/connections/<id>.ts
 * @param request CreateConnectionRequest 请求体
 * @returns 201 创建成功 / 400 参数缺失或非法 / 401 未授权 / 409 已存在 / 500 服务器错误
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CreateConnectionRequest;
    const { id, type, url, description, tokenEnvVar } = body;

    // 参数校验
    if (!id || !type || !description || !tokenEnvVar) {
      return Response.json(
        { error: "id, type, description, tokenEnvVar are required" },
        { status: 400 }
      );
    }
    if (type !== "mcp" && type !== "openapi") {
      return Response.json(
        { error: "type must be 'mcp' or 'openapi'" },
        { status: 400 }
      );
    }
    if (!ID_PATTERN.test(id)) {
      return Response.json(
        {
          error:
            "id must contain only letters, numbers, hyphens, or underscores",
        },
        { status: 400 }
      );
    }
    if (!ENV_VAR_PATTERN.test(tokenEnvVar)) {
      return Response.json(
        {
          error:
            "tokenEnvVar must be a valid environment variable name (letters, digits, underscore; must not start with a digit)",
        },
        { status: 400 }
      );
    }
    // 两种类型都需要 url（MCP 服务地址或 OpenAPI spec 地址）
    if (!url) {
      return Response.json({ error: "url is required" }, { status: 400 });
    }

    const filePath = join(CONNECTIONS_DIR, `${id}.ts`);

    // 检查文件是否已存在
    try {
      await fs.access(filePath);
      return Response.json(
        { error: `Connection '${id}' already exists` },
        { status: 409 }
      );
    } catch {
      // 文件不存在，继续创建
    }

    // 根据类型生成模板
    let content: string;
    if (type === "mcp") {
      content = buildMcpTemplate({ id, url, description, tokenEnvVar });
    } else {
      // openapi: url 作为 spec url，baseUrl 从 spec url 推导 origin
      let baseUrl: string;
      try {
        baseUrl = new URL(url).origin;
      } catch {
        return Response.json(
          { error: "url must be a valid URL" },
          { status: 400 }
        );
      }
      content = buildOpenApiTemplate({
        id,
        specUrl: url,
        baseUrl,
        description,
        tokenEnvVar,
      });
    }

    // 确保目录存在后写入文件
    await fs.mkdir(CONNECTIONS_DIR, { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");

    return Response.json(
      {
        connection: {
          id,
          type,
          path: `agent/connections/${id}.ts`,
          content,
        },
      },
      { status: 201 }
    );
  } catch (_error) {
    return Response.json(
      { error: "Failed to create connection" },
      { status: 500 }
    );
  }
}

/**
 * PUT: 更新 connection 文件内容
 * @param request UpdateConnectionRequest 请求体（id + content）
 * @returns 200 更新成功 / 400 参数缺失 / 401 未授权 / 404 文件不存在 / 500 服务器错误
 */
export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as UpdateConnectionRequest;
    const { id, content } = body;

    if (!id || typeof content !== "string") {
      return Response.json(
        { error: "id and content are required" },
        { status: 400 }
      );
    }
    if (!ID_PATTERN.test(id)) {
      return Response.json(
        {
          error:
            "id must contain only letters, numbers, hyphens, or underscores",
        },
        { status: 400 }
      );
    }

    const filePath = join(CONNECTIONS_DIR, `${id}.ts`);

    // 检查文件是否存在
    try {
      await fs.access(filePath);
    } catch {
      return Response.json(
        { error: `Connection '${id}' not found` },
        { status: 404 }
      );
    }

    await fs.writeFile(filePath, content, "utf-8");

    return Response.json({
      connection: {
        id,
        type: detectType(content),
        path: `agent/connections/${id}.ts`,
        content,
      },
    });
  } catch (_error) {
    return Response.json(
      { error: "Failed to update connection" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 删除指定 connection 文件
 * @param request 通过 query 参数 id 指定要删除的 connection
 * @returns 200 删除成功 / 400 缺少 id / 401 未授权 / 404 文件不存在 / 500 服务器错误
 */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  if (!ID_PATTERN.test(id)) {
    return Response.json(
      {
        error: "id must contain only letters, numbers, hyphens, or underscores",
      },
      { status: 400 }
    );
  }

  const filePath = join(CONNECTIONS_DIR, `${id}.ts`);

  try {
    await fs.unlink(filePath);
    return Response.json({ success: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json(
        { error: `Connection '${id}' not found` },
        { status: 404 }
      );
    }
    return Response.json(
      { error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
