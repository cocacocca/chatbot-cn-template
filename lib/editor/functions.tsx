/** @file 编辑器内容与 Markdown 互转、建议高亮装饰（decorations）构建 */
"use client";

import { defaultMarkdownSerializer } from "prosemirror-markdown";
import { DOMParser, type Node } from "prosemirror-model";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { renderToString } from "react-dom/server";

import { MessageResponse } from "@/components/ai-elements/message";

import { documentSchema } from "./config";
import type { UISuggestion } from "./suggestions";

/**
 * 将 Markdown 字符串解析为 ProseMirror 文档节点
 * 流程：用 React 将 Markdown 渲染为 HTML 字符串 → 注入临时容器 → 用 schema 解析为文档节点
 * @param content Markdown 文本
 * @returns ProseMirror 文档节点
 */
export const buildDocumentFromContent = (content: string) => {
  const parser = DOMParser.fromSchema(documentSchema);
  const stringFromMarkdown = renderToString(
    <MessageResponse>{content}</MessageResponse>
  );
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = stringFromMarkdown;
  return parser.parse(tempContainer);
};

/**
 * 将 ProseMirror 文档节点序列化为 Markdown 字符串
 * @param document ProseMirror 文档节点
 * @returns Markdown 文本
 */
export const buildContentFromDocument = (document: Node) => {
  return defaultMarkdownSerializer.serialize(document);
};

/**
 * 根据建议列表构建编辑器装饰集合（用于高亮建议覆盖的文本区间）
 * @param suggestions UI 建议列表（含选区起止位置）
 * @param _view 编辑器视图（用于获取当前文档）
 * @returns 装饰集合
 */
export const createDecorations = (
  suggestions: UISuggestion[],
  _view: EditorView
) => {
  const decorations: Decoration[] = [];

  for (const suggestion of suggestions) {
    decorations.push(
      Decoration.inline(
        suggestion.selectionStart,
        suggestion.selectionEnd,
        {
          class: "suggestion-highlight",
          "data-suggestion-id": suggestion.id,
        },
        {
          suggestionId: suggestion.id,
          type: "highlight",
        }
      )
    );
  }

  return DecorationSet.create(_view.state.doc, decorations);
};
