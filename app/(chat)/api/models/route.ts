import { auth } from "@/app/(auth)/auth";
import { getModelCapabilitiesMap } from "@/lib/ai/models";
import {
  createModelConfig,
  deleteModelConfig,
  getAllModelConfigs,
  updateModelConfig,
} from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configs = await getAllModelConfigs();
  const capabilities = await getModelCapabilitiesMap();

  return Response.json({
    models: configs,
    capabilities,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
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
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const result = await updateModelConfig({ id, ...data });

    return Response.json(result);
  } catch (_error) {
    return Response.json(
      { error: "Failed to update model config" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const result = await deleteModelConfig({ id });
    return Response.json(result);
  } catch (_error) {
    return Response.json(
      { error: "Failed to delete model config" },
      { status: 500 }
    );
  }
}
