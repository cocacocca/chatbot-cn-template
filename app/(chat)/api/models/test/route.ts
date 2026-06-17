import { createClient } from "@/lib/supabase/server";

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
