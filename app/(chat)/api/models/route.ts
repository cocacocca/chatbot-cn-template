/** @file 模型配置 API 路由：提供模型列表查询（GET）、创建（POST）、更新（PUT）、删除（DELETE） */
import { getModelCapabilitiesMap } from "@/lib/ai/models";
import {
  createModelConfig,
  deleteModelConfig,
  getAllModelConfigsForClient,
  updateModelConfig,
} from "@/lib/ai/models-db";
import { createClient } from "@/lib/supabase/server";

/**
 * 获取当前用户的所有模型配置与能力映射
 * 数据库为空时，从环境变量构造 fallback 模型（与 getChatModels 逻辑一致）。
 * @returns JSON { models, capabilities }
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await getAllModelConfigsForClient(user.id);

  // 数据库为空时，从环境变量构造 fallback 模型（与 getChatModels 逻辑一致）
  let models = configs;
  if (configs.length === 0) {
    const envModelId = process.env.OPENAI_BASE_MODEL;
    if (envModelId) {
      models = [
        {
          id: envModelId,
          name: envModelId,
          provider: "openai",
          baseUrl: process.env.OPENAI_BASE_URL || null,
          apiKey: null,
          capabilities: { tools: true, vision: false, reasoning: false },
          reasoningEffort: null,
          isDefault: true,
          isTitleModel: true,
          createdAt: "",
          updatedAt: "",
        },
      ];
    }
  }

  const capabilities = await getModelCapabilitiesMap(user.id);

  return Response.json({
    models,
    capabilities,
  });
}

/**
 * 创建新的模型配置
 * 必填字段：id、name、provider；其余字段缺省时使用默认值。
 * @param request 包含模型配置字段的请求体
 * @returns 201 成功创建 / 400 参数缺失 / 401 未授权 / 500 服务器错误
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
    const body = await request.json();
    const {
      id,
      name,
      provider,
      baseUrl,
      apiKey,
      capabilities,
      reasoningEffort,
      isDefault,
      isTitleModel,
    } = body;

    if (!id || !name || !provider) {
      return Response.json(
        { error: "id, name, and provider are required" },
        { status: 400 }
      );
    }

    const result = await createModelConfig(user.id, {
      id,
      name,
      provider,
      baseUrl: baseUrl || undefined,
      apiKey: apiKey || undefined,
      capabilities: capabilities || {
        tools: true,
        vision: false,
        reasoning: false,
      },
      reasoningEffort: reasoningEffort || undefined,
      isDefault: isDefault ?? false,
      isTitleModel: isTitleModel ?? false,
    });

    return Response.json(result, { status: 201 });
  } catch (_error) {
    return Response.json(
      { error: "Failed to create model config" },
      { status: 500 }
    );
  }
}

/**
 * 更新已有模型配置
 * 通过请求体中的 id 定位记录，其余字段为待更新内容。
 * @param request 包含 id 与待更新字段的请求体
 * @returns 200 成功更新 / 400 缺少 id / 401 未授权 / 500 服务器错误
 */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const result = await updateModelConfig(user.id, id, data);

    return Response.json(result);
  } catch (_error) {
    return Response.json(
      { error: "Failed to update model config" },
      { status: 500 }
    );
  }
}

/**
 * 删除指定模型配置
 * @param request 通过 query 参数 id 指定要删除的模型 ID
 * @returns 200 成功删除 / 400 缺少 id / 401 未授权 / 500 服务器错误
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await deleteModelConfig(user.id, id);
    return Response.json({ success: true });
  } catch (_error) {
    return Response.json(
      { error: "Failed to delete model config" },
      { status: 500 }
    );
  }
}
