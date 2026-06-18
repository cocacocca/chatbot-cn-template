/** @file Artifact 文档处理器工厂：统一封装不同类型文档的创建/更新流程与持久化 */
import type { UIMessageStreamWriter } from "ai";
import { codeDocumentHandler } from "@/artifacts/code/server";
import { sheetDocumentHandler } from "@/artifacts/sheet/server";
import { textDocumentHandler } from "@/artifacts/text/server";
import type { ArtifactKind } from "@/components/chat/artifact";
import { saveDocument } from "@/lib/ai/artifacts-db";
import type { ChatMessage, Document, Session } from "@/lib/types";

/** 保存文档所需参数 */
export type SaveDocumentProps = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
};

/** 创建文档回调参数 */
export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  modelId: string;
};

/** 更新文档回调参数 */
export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
  modelId: string;
};

/**
 * 文档处理器接口：按 artifact 类型提供创建与更新能力
 * @template T artifact 类型
 */
export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
};

/**
 * 创建文档处理器：包装业务侧的草稿生成逻辑，并在生成后统一持久化
 * 业务侧只需返回草稿内容，持久化由本工厂负责
 * @param config 处理器配置，包含 kind 与 onCreateDocument/onUpdateDocument 草稿生成函数
 * @returns 标准化的 DocumentHandler
 */
export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        dataStream: args.dataStream,
        session: args.session,
        modelId: args.modelId,
      });

      // 已登录用户才落库
      if (args.session?.user?.id) {
        await saveDocument({
          id: args.id,
          title: args.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
        });
      }

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        dataStream: args.dataStream,
        session: args.session,
        modelId: args.modelId,
      });

      // 已登录用户才落库
      if (args.session?.user?.id) {
        await saveDocument({
          id: args.document.id,
          title: args.document.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id,
        });
      }

      return;
    },
  };
}

/** 按 artifact 类型注册的处理器列表（text / code / sheet） */
export const documentHandlersByArtifactKind: DocumentHandler[] = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
];

/** 支持的 artifact 类型常量 */
export const artifactKinds = ["text", "code", "sheet"] as const;
