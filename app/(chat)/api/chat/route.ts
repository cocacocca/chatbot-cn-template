import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import { saveChat, saveMessages } from "@/lib/ai/chat-db";
import { entitlements } from "@/lib/ai/entitlements";
import {
  getChatModels,
  getDefaultModelId,
  getModelCapabilitiesMap,
  isAllowedModelId,
} from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { isProductionEnvironment } from "@/lib/constants";
import { getMessageCountByUserId } from "@/lib/db/server-queries";
import { ChatbotError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage, DBMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel } = requestBody;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const session = { user: { id: user.id } };

    const allowed = await isAllowedModelId(user.id, selectedChatModel);
    const defaultId = await getDefaultModelId(user.id);
    const chatModel = allowed ? selectedChatModel : defaultId;

    const messageCount = await getMessageCountByUserId();

    if (messageCount > entitlements.maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    // 使用 server client（受 RLS 保护），chat/messages 查询自动按用户隔离
    const serverClient = supabase;

    // 查询 chat 是否存在
    const { data: chat } = await serverClient
      .from("cct_chat")
      .select("*")
      .eq("id", id)
      .single();

    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.user_id !== user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      const { data: dbMessages } = await serverClient
        .from("cct_message")
        .select("*")
        .eq("chat_id", id)
        .order("created_at", { ascending: true });
      messagesFromDb = (dbMessages ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        chatId: m.chat_id as string,
        role: m.role as string,
        parts: m.parts,
        attachments: m.attachments,
        createdAt: new Date(m.created_at as string),
      }));
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: user.id,
        title: "New chat",
      });
      titlePromise = generateTitleFromUserMessage({ message, userId: user.id });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    const requestHints: RequestHints = {
      longitude: undefined,
      latitude: undefined,
      city: undefined,
      country: undefined,
    };

    if (message?.role === "user") {
      await saveMessages([
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ]);
    }

    const allModels = await getChatModels(user.id);
    const modelConfig = allModels.find((m) => m.id === chatModel);
    const capabilitiesMap = await getModelCapabilitiesMap(user.id);
    const capabilities = capabilitiesMap[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;

    const modelMessages = await convertToModelMessages(uiMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: await getLanguageModel(chatModel, user.id),
          system: systemPrompt({ requestHints, supportsTools }),
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            isReasoningModel && !supportsTools
              ? []
              : [
                  "getWeather",
                  "createDocument",
                  "editDocument",
                  "updateDocument",
                  "requestSuggestions",
                ],
          ...(modelConfig?.reasoningEffort && {
            providerOptions: {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            },
          }),
          tools: {
            getWeather,
            createDocument: createDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            editDocument: editDocument({ dataStream, session }),
            updateDocument: updateDocument({
              session,
              dataStream,
              modelId: chatModel,
            }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
              modelId: chatModel,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        dataStream.merge(
          result.toUIMessageStream({ sendReasoning: isReasoningModel })
        );

        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ type: "data-chat-title", data: title });
            // 使用 server client（受 RLS 保护）更新 chat title
            await supabase
              .from("cct_chat")
              .update({ title })
              .eq("id", id)
              .eq("user_id", user.id);
          } catch (_) {
            /* non-fatal */
          }
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              // 使用 server client（受 RLS 保护）更新 message parts
              await supabase
                .from("cct_message")
                .update({ parts: finishedMsg.parts })
                .eq("id", finishedMsg.id);
            } else {
              await saveMessages([
                {
                  id: finishedMsg.id,
                  role: finishedMsg.role,
                  parts: finishedMsg.parts,
                  createdAt: new Date(),
                  attachments: [],
                  chatId: id,
                },
              ]);
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages(
            finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            }))
          );
        }
      },
      onError: () => {
        return "发生错误，请稍后重试";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    console.error("Unhandled error in chat API:", error);
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  // 使用 server client（受 RLS 保护），自动按用户隔离
  const { data: chat } = await supabase
    .from("cct_chat")
    .select("*")
    .eq("id", id)
    .single();

  if (chat?.user_id !== user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  await supabase.from("cct_chat").delete().eq("id", id);

  return Response.json({ id }, { status: 200 });
}
