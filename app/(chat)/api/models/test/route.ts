/** @file 模型连接测试 API：验证用户提供的 Base URL 与 API Key 是否可访问 */
import { createClient } from "@/lib/supabase/server";

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

    // 拼接 models 列表端点，兼容 baseUrl 末尾是否带 /
    const url = baseUrl.endsWith("/")
      ? `${baseUrl}models`
      : `${baseUrl}/models`;

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
