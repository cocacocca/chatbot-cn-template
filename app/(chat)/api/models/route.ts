import { getModelCapabilitiesMap } from "@/lib/ai/models";
import {
  createModelConfig,
  deleteModelConfig,
  getAllModelConfigsForClient,
  updateModelConfig,
} from "@/lib/ai/models-db";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await getAllModelConfigsForClient();

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

  const capabilities = await getModelCapabilitiesMap();

  return Response.json({
    models,
    capabilities,
  });
}

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

    const result = await createModelConfig({
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

    const result = await updateModelConfig(id, data);

    return Response.json(result);
  } catch (_error) {
    return Response.json(
      { error: "Failed to update model config" },
      { status: 500 }
    );
  }
}

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
    await deleteModelConfig(id);
    return Response.json({ success: true });
  } catch (_error) {
    return Response.json(
      { error: "Failed to delete model config" },
      { status: 500 }
    );
  }
}
