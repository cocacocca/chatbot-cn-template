/** @file 编辑器建议（suggestions）插件：定位建议选区、注册 ProseMirror 装饰与交互 */
import type { Node } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { DecorationSet } from "prosemirror-view";
import type { Suggestion } from "@/lib/db/schema";

/**
 * UI 建议类型：在数据库 Suggestion 基础上扩展选区起止位置
 * 用于在编辑器中定位建议所覆盖的文本区间
 */
export interface UISuggestion extends Suggestion {
  selectionStart: number;
  selectionEnd: number;
}

type Position = {
  start: number;
  end: number;
};

/**
 * 在文档中查找指定文本首次出现的位置区间
 * @param doc ProseMirror 文档节点
 * @param searchText 待查找的文本
 * @returns 命中位置区间；未找到返回 null
 */
function findPositionsInDoc(doc: Node, searchText: string): Position | null {
  let positions: { start: number; end: number } | null = null;

  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    if (node.isText && node.text) {
      const index = node.text.indexOf(searchText);

      if (index !== -1) {
        positions = {
          start: pos + index,
          end: pos + index + searchText.length,
        };

        return false;
      }
    }

    return true;
  });

  return positions;
}

/**
 * 为建议列表补充选区位置信息：在文档中定位每条建议的 originalText
 * 未找到位置时，选区回退为 [0, 0]
 * @param doc ProseMirror 文档节点
 * @param suggestions 原始建议列表
 * @returns 带 selectionStart/selectionEnd 的 UI 建议列表
 */
export function projectWithPositions(
  doc: Node,
  suggestions: Suggestion[]
): UISuggestion[] {
  return suggestions.map((suggestion) => {
    const positions = findPositionsInDoc(doc, suggestion.originalText);

    if (!positions) {
      return {
        ...suggestion,
        selectionStart: 0,
        selectionEnd: 0,
      };
    }

    return {
      ...suggestion,
      selectionStart: positions.start,
      selectionEnd: positions.end,
    };
  });
}

/** 建议插件的唯一 key，用于读写插件状态 */
export const suggestionsPluginKey = new PluginKey("suggestions");

/**
 * 建议插件：维护装饰集合与选中态，处理建议高亮的鼠标按下事件
 * - state：保存 decorations 与 selected
 * - apply：响应事务，更新装饰或随文档映射迁移
 * - decorations：向编辑器提供当前装饰集合
 * - handleDOMEvents：拦截建议高亮区域的 mousedown，防止选区被破坏
 */
export const suggestionsPlugin = new Plugin({
  key: suggestionsPluginKey,
  state: {
    init() {
      return { decorations: DecorationSet.empty, selected: null };
    },
    apply(tr, state) {
      const newDecorations = tr.getMeta(suggestionsPluginKey);
      if (newDecorations) {
        return newDecorations;
      }

      return {
        decorations: state.decorations.map(tr.mapping, tr.doc),
        selected: state.selected,
      };
    },
  },
  props: {
    decorations(state) {
      return this.getState(state)?.decorations ?? DecorationSet.empty;
    },
    handleDOMEvents: {
      mousedown(_view, event) {
        const target = event.target as HTMLElement;
        // 点击建议高亮区域时阻止默认行为，避免选区丢失
        if (target.closest(".suggestion-highlight")) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  },
});
