/** @file ProseMirror 编辑器 schema 定义、标题输入规则与事务处理逻辑 */
import { textblockTypeInputRule } from "prosemirror-inputrules";
import { Schema } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import type { Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { MutableRefObject } from "react";

import { buildContentFromDocument } from "./functions";

/**
 * 文档 schema：基于基础 schema 扩展列表节点
 * 在 paragraph block* 位置插入列表节点，保留原有 marks
 */
export const documentSchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
  marks: schema.spec.marks,
});

/**
 * 构造标题输入规则：在行首输入 `# ` ~ `#{level} ` 时转换为对应级别的标题节点
 * @param level 标题级别（1-6）
 * @returns ProseMirror 输入规则
 */
export function headingRule(level: number) {
  return textblockTypeInputRule(
    new RegExp(`^(#{1,${level}})\\s$`),
    documentSchema.nodes.heading,
    () => ({ level })
  );
}

/**
 * 处理编辑器事务：应用事务到编辑器视图，并在文档变更时触发保存回调
 * @param params.transaction ProseMirror 事务对象
 * @param params.editorRef 编辑器视图的 ref
 * @param params.onSaveContent 保存回调，接收更新后的内容与是否防抖的标志
 */
export const handleTransaction = ({
  transaction,
  editorRef,
  onSaveContent,
}: {
  transaction: Transaction;
  editorRef: MutableRefObject<EditorView | null>;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}) => {
  if (!editorRef?.current) {
    return;
  }

  const newState = editorRef.current.state.apply(transaction);
  editorRef.current.updateState(newState);

  // 文档发生变更且未标记 no-save 时，重新序列化内容并触发保存
  if (transaction.docChanged && !transaction.getMeta("no-save")) {
    const updatedContent = buildContentFromDocument(newState.doc);

    if (transaction.getMeta("no-debounce")) {
      // 标记 no-debounce 时立即保存（不防抖）
      onSaveContent(updatedContent, false);
    } else {
      // 默认走防抖保存
      onSaveContent(updatedContent, true);
    }
  }
};
