/** @file Connections 列表 Hook，基于 SWR 拉取 agent/connections 目录下的 connection 文件 */
"use client";

import useSWR from "swr";

/** Connection 类型 */
export type ConnectionType = "mcp" | "openapi";

/** GET 接口返回的单个 connection 项 */
export type ConnectionItem = {
  id: string;
  type: ConnectionType;
  path: string;
  content: string;
};

/** GET 接口响应 */
type ConnectionsResponse = {
  connections: ConnectionItem[];
};

/** POST 请求体 */
export type CreateConnectionRequest = {
  id: string;
  type: ConnectionType;
  url?: string;
  description: string;
  tokenEnvVar: string;
};

/** PUT 请求体 */
export type UpdateConnectionRequest = {
  id: string;
  content: string;
};

/** Connections SWR key，固定指向 /api/admin/connections */
export const CONNECTIONS_SWR_KEY = "/api/admin/connections";

/**
 * Connections 专用 fetcher：ok 返回 json，失败抛错
 * 错误响应格式与 API route 一致（{ error: string }）
 * @param url 请求地址
 * @returns 解析后的 ConnectionsResponse
 */
async function connectionsFetcher(url: string): Promise<ConnectionsResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({
      error: "请求失败",
    }))) as { error?: string };
    throw new Error(data.error ?? "请求失败");
  }
  return (await res.json()) as ConnectionsResponse;
}

/**
 * Connections 列表 Hook
 * 拉取后端 connection 文件列表，返回数据、加载状态、错误及 mutate 方法
 * @returns connections 列表、isLoading、error、mutate
 */
export function useConnections() {
  const { data, error, isLoading, mutate } = useSWR<ConnectionsResponse>(
    CONNECTIONS_SWR_KEY,
    connectionsFetcher,
    { revalidateOnFocus: false }
  );

  const connections = data?.connections ?? [];

  return {
    connections,
    isLoading,
    error,
    mutate,
  };
}
