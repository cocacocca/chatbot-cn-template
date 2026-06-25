/** @file 模型连接测试 API：验证用户提供的 Base URL 与 API Key 是否可访问 */
import { createClient } from "@/lib/supabase/server";

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === "localhost" || host.endsWith(".localhost")) {
    return true;
  }

  // IPv6 localhost / link-local / unique-local
  if (
    host === "::1" ||
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    return true;
  }

  // IPv4 checks
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const parts = ipv4Match.slice(1).map((v) => Number(v));
    if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }

    const [a, b] = parts;
    if (
      a === 10 || // 10.0.0.0/8
      a === 127 || // 127.0.0.0/8
      (a === 169 && b === 254) || // 169.254.0.0/16
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      a === 0 // 0.0.0.0/8
    ) {
      return true;
    }
  }

  return false;
}

function buildSafeModelsUrl(inputBaseUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(inputBaseUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  if (parsed.username || parsed.password) {
    return null;
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return null;
  }

  // 仅允许默认端口，避免探测内网非常规服务
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return null;
  }

  // 固定请求到 /models，忽略用户提供的 path/query/hash
  parsed.pathname = parsed.pathname.endsWith("/")
    ? `${parsed.pathname}models`
    : `${parsed.pathname}/models`;
  parsed.search = "";
  parsed.hash = "";

  return parsed.toString();
}

/**
 * 测试模型 API 连接
 * 调用 `${baseUrl}/models` 端点验证 API Key 有效性，并返回可用模型数量。
 * @param request 包含 baseUrl 与 apiKey 的请求体
 * @returns JSON { success, message }，message 含成功/失败描述
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { baseUrl, apiKey } = await request.json();

    if (!baseUrl || !apiKey) {
      return Response.json(
        { success: false, message: "缺少 Base URL 或 API Key" },
        { status: 400 }
      );
    }

    // 校验并构造安全的 models 列表端点
    const url = buildSafeModelsUrl(baseUrl);
    if (!url) {
      return Response.json(
        { success: false, message: "Base URL 不合法或不被允许" },
        { status: 400 }
      );
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const data = await res.json();
      const count = Array.isArray(data?.data) ? data.data.length : 0;
      return Response.json({
        success: true,
        message: `连接成功，可用模型 ${count} 个`,
      });
    }

    // 请求失败：返回状态码与响应文本片段
    const text = await res.text().catch(() => "");
    return Response.json({
      success: false,
      message: `连接失败 (${res.status}): ${text.slice(0, 200) || res.statusText}`,
    });
  } catch (_error) {
    const msg = _error instanceof Error ? _error.message : "未知错误";
    return Response.json({
      success: false,
      message: `连接失败: ${msg}`,
    });
  }
}
