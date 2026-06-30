/** @file ProseMirror 文档差异（diff）算法：基于 diff-match-patch 实现节点级与句子级差异计算 */
// Modified from https://github.com/hamflx/prosemirror-diff/blob/master/src/diff.js

import { diff_match_patch } from "diff-match-patch";
import { Fragment, Node } from "prosemirror-model";

/**
 * 差异类型枚举
 * - Unchanged: 未变更
 * - Deleted: 删除
 * - Inserted: 新增
 */
export const DiffType = {
  Unchanged: 0,
  Deleted: -1,
  Inserted: 1,
};

/**
 * 对比新旧节点并生成带差异标记的合并节点
 * 算法：先从两端向中间找相同子节点（前缀/后缀），再对中间差异段做节点匹配与递归 patch
 * @param schema ProseMirror schema
 * @param oldNode 旧文档节点
 * @param newNode 新文档节点
 * @returns 合并后的节点（包含 diffMark 标记）
 */
export const patchDocumentNode = (schema, oldNode, newNode) => {
  assertNodeTypeEqual(oldNode, newNode);

  const finalLeftChildren = [];
  const finalRightChildren = [];

  // 规范化子节点：连续的文本节点合并为一个数组元素，块节点保持单元素
  const oldChildren = normalizeNodeContent(oldNode);
  const newChildren = normalizeNodeContent(newNode);
  const oldChildLen = oldChildren.length;
  const newChildLen = newChildren.length;
  const minChildLen = Math.min(oldChildLen, newChildLen);

  let left = 0;
  let right = 0;

  // 从左向右扫描相同前缀
  for (; left < minChildLen; left++) {
    const oldChild = oldChildren[left];
    const newChild = newChildren[left];
    if (!isNodeEqual(oldChild, newChild)) {
      break;
    }
    finalLeftChildren.push(...ensureArray(oldChild));
  }

  // 从右向左扫描相同后缀
  for (; right + left + 1 < minChildLen; right++) {
    const oldChild = oldChildren[oldChildLen - right - 1];
    const newChild = newChildren[newChildLen - right - 1];
    if (!isNodeEqual(oldChild, newChild)) {
      break;
    }
    finalRightChildren.unshift(...ensureArray(oldChild));
  }

  // 截取中间存在差异的子节点段
  const diffOldChildren = oldChildren.slice(left, oldChildLen - right);
  const diffNewChildren = newChildren.slice(left, newChildLen - right);

  if (diffOldChildren.length && diffNewChildren.length) {
    // 在差异段中寻找最长公共子段，按匹配长度降序排序
    const matchedNodes = matchNodes(
      schema,
      diffOldChildren,
      diffNewChildren
    ).sort((a, b) => b.count - a.count);
    const bestMatch = matchedNodes[0];
    if (bestMatch) {
      const { oldStartIndex, newStartIndex, oldEndIndex, newEndIndex } =
        bestMatch;
      const oldBeforeMatchChildren = diffOldChildren.slice(0, oldStartIndex);
      const newBeforeMatchChildren = diffNewChildren.slice(0, newStartIndex);

      // 匹配点之前的部分递归 patch
      finalLeftChildren.push(
        ...patchRemainNodes(
          schema,
          oldBeforeMatchChildren,
          newBeforeMatchChildren
        )
      );
      // 匹配段直接复用旧节点
      finalLeftChildren.push(
        ...diffOldChildren.slice(oldStartIndex, oldEndIndex)
      );

      const oldAfterMatchChildren = diffOldChildren.slice(oldEndIndex);
      const newAfterMatchChildren = diffNewChildren.slice(newEndIndex);

      // 匹配点之后的部分递归 patch
      finalRightChildren.unshift(
        ...patchRemainNodes(
          schema,
          oldAfterMatchChildren,
          newAfterMatchChildren
        )
      );
    } else {
      // 无匹配段，整体递归 patch
      finalLeftChildren.push(
        ...patchRemainNodes(schema, diffOldChildren, diffNewChildren)
      );
    }
  } else {
    // 其中一段为空，直接递归 patch
    finalLeftChildren.push(
      ...patchRemainNodes(schema, diffOldChildren, diffNewChildren)
    );
  }

  return createNewNode(oldNode, [...finalLeftChildren, ...finalRightChildren]);
};

/**
 * 在新旧子节点序列中查找所有公共子段
 * @param _schema schema（当前未使用，保留以备扩展）
 * @param oldChildren 旧子节点序列
 * @param newChildren 新子节点序列
 * @returns 匹配段数组，包含起止索引与匹配长度
 */
const matchNodes = (_schema, oldChildren, newChildren) => {
  const matches = [];
  for (
    let oldStartIndex = 0;
    oldStartIndex < oldChildren.length;
    oldStartIndex++
  ) {
    const oldStartNode = oldChildren[oldStartIndex];
    const newStartIndex = findMatchNode(newChildren, oldStartNode);

    if (newStartIndex !== -1) {
      // 找到起点后向后扩展，直到节点不再相等
      let oldEndIndex = oldStartIndex + 1;
      let newEndIndex = newStartIndex + 1;
      for (
        ;
        oldEndIndex < oldChildren.length && newEndIndex < newChildren.length;
        oldEndIndex++, newEndIndex++
      ) {
        const oldEndNode = oldChildren[oldEndIndex];
        if (!isNodeEqual(newChildren[newEndIndex], oldEndNode)) {
          break;
        }
      }
      matches.push({
        oldStartIndex,
        newStartIndex,
        oldEndIndex,
        newEndIndex,
        count: newEndIndex - newStartIndex,
      });
    }
  }
  return matches;
};

/**
 * 在子节点序列中查找首个与指定节点相等的节点索引
 * @param children 子节点序列
 * @param node 待查找节点
 * @param startIndex 起始查找位置
 * @returns 命中索引；未找到返回 -1
 */
const findMatchNode = (children, node, startIndex = 0) => {
  for (let i = startIndex; i < children.length; i++) {
    if (isNodeEqual(children[i], node)) {
      return i;
    }
  }
  return -1;
};

/**
 * 对剩余的未匹配子节点段进行 patch：左右两端分别尝试更新，中间段标记为删除/新增
 * @param schema ProseMirror schema
 * @param oldChildren 旧子节点段
 * @param newChildren 新子节点段
 * @returns 合并后的节点数组
 */
const patchRemainNodes = (schema, oldChildren, newChildren) => {
  const finalLeftChildren = [];
  const finalRightChildren = [];
  const oldChildLen = oldChildren.length;
  const newChildLen = newChildren.length;
  let left = 0;
  let right = 0;
  while (oldChildLen - left - right > 0 && newChildLen - left - right > 0) {
    const leftOldNode = oldChildren[left];
    const leftNewNode = newChildren[left];
    const rightOldNode = oldChildren[oldChildLen - right - 1];
    const rightNewNode = newChildren[newChildLen - right - 1];
    // 文本节点不在此处处理（交给 patchTextNodes），仅处理类型匹配的块节点
    let updateLeft =
      !isTextNode(leftOldNode) && matchNodeType(leftOldNode, leftNewNode);
    let updateRight =
      !isTextNode(rightOldNode) && matchNodeType(rightOldNode, rightNewNode);
    // 文本节点数组走句子级 diff
    if (Array.isArray(leftOldNode) && Array.isArray(leftNewNode)) {
      finalLeftChildren.push(
        ...patchTextNodes(schema, leftOldNode, leftNewNode)
      );
      left += 1;
      continue;
    }

    // 左右两端都可更新时，选择相似度更高的一端更新，另一端留到下一轮
    if (updateLeft && updateRight) {
      const equalityLeft = computeChildEqualityFactor(leftOldNode, leftNewNode);
      const equalityRight = computeChildEqualityFactor(
        rightOldNode,
        rightNewNode
      );
      if (equalityLeft < equalityRight) {
        updateLeft = false;
      } else {
        updateRight = false;
      }
    }
    if (updateLeft) {
      // 递归 patch 左端节点
      finalLeftChildren.push(
        patchDocumentNode(schema, leftOldNode, leftNewNode)
      );
      left += 1;
    } else if (updateRight) {
      // 递归 patch 右端节点
      finalRightChildren.unshift(
        patchDocumentNode(schema, rightOldNode, rightNewNode)
      );
      right += 1;
    } else {
      // Delete and insert
      // 左端无法匹配，标记旧节点为删除、新节点为新增
      finalLeftChildren.push(
        createDiffNode(schema, leftOldNode, DiffType.Deleted)
      );
      finalLeftChildren.push(
        createDiffNode(schema, leftNewNode, DiffType.Inserted)
      );
      left += 1;
    }
  }

  // 处理剩余的纯删除段
  const deleteNodeLen = oldChildLen - left - right;
  const insertNodeLen = newChildLen - left - right;
  if (deleteNodeLen) {
    finalLeftChildren.push(
      ...oldChildren
        .slice(left, left + deleteNodeLen)
        .flat()
        .map((node) => createDiffNode(schema, node, DiffType.Deleted))
    );
  }

  // 处理剩余的纯新增段
  if (insertNodeLen) {
    finalRightChildren.unshift(
      ...newChildren
        .slice(left, left + insertNodeLen)
        .flat()
        .map((node) => createDiffNode(schema, node, DiffType.Inserted))
    );
  }

  return [...finalLeftChildren, ...finalRightChildren];
};

// Updated function to perform sentence-level diffs
/**
 * 对文本节点数组执行句子级 diff
 * 流程：拼接文本 → 分句 → 句子映射为字符 → diff_match_patch 计算 → 还原为带 diffMark 的文本节点
 * @param schema ProseMirror schema
 * @param oldNode 旧文本节点数组
 * @param newNode 新文本节点数组
 * @returns 带差异标记的文本节点数组
 */
export const patchTextNodes = (schema, oldNode, newNode) => {
  const dmp = new diff_match_patch();

  // Concatenate the text from the text nodes
  // 拼接所有文本节点的文本内容
  const oldText = oldNode.map((n) => getNodeText(n)).join("");
  const newText = newNode.map((n) => getNodeText(n)).join("");

  // Tokenize the text into sentences
  // 按句子切分文本
  const oldSentences = tokenizeSentences(oldText);
  const newSentences = tokenizeSentences(newText);

  // Map sentences to unique characters
  // 将句子映射为唯一字符，便于 diff_match_patch 处理
  const { chars1, chars2, lineArray } = sentencesToChars(
    oldSentences,
    newSentences
  );

  // Perform the diff
  // 执行字符级 diff（实际对应句子级）
  let diffs = dmp.diff_main(chars1, chars2, false);

  // Convert back to sentences
  // 将字符还原为句子
  diffs = diffs.map(([type, text]) => {
    const sentences = text
      .split("")
      .map((char) => lineArray[char.charCodeAt(0)]);
    return [type, sentences];
  });

  // Map diffs to nodes
  // 将每个句子的 diff 结果转换为带 diffMark 的文本节点
  const res = diffs.flatMap(([type, sentences]) => {
    return sentences.map((sentence) => {
      const node = createTextNode(
        schema,
        sentence,
        type === DiffType.Unchanged ? [] : [createDiffMark(schema, type)]
      );
      return node;
    });
  });

  return res;
};

// Function to tokenize text into sentences
/**
 * 将文本切分为句子（按 .!? 及其后空白分句）
 * @param text 原始文本
 * @returns 句子数组
 */
const tokenizeSentences = (text) => {
  return text.match(/[^.!?]+[.!?]*\s*/g) || [];
};

// Function to map sentences to unique characters
/**
 * 将新旧句子序列映射为唯一字符序列，供 diff_match_patch 使用
 * 相同句子映射为同一字符，从而把句子级 diff 降维为字符级 diff
 * @param oldSentences 旧句子序列
 * @param newSentences 新句子序列
 * @returns chars1 旧句子对应的字符序列、chars2 新句子对应的字符序列、lineArray 字符码点到句子的反查表
 */
const sentencesToChars = (oldSentences, newSentences) => {
  const lineArray = [];
  const lineHash = {};
  let lineStart = 0;

  const chars1 = oldSentences
    .map((sentence) => {
      const line = sentence;
      if (line in lineHash) {
        return String.fromCharCode(lineHash[line]);
      }
      lineHash[line] = lineStart;
      lineArray[lineStart] = line;
      lineStart++;
      return String.fromCharCode(lineHash[line]);
    })
    .join("");

  const chars2 = newSentences
    .map((sentence) => {
      const line = sentence;
      if (line in lineHash) {
        return String.fromCharCode(lineHash[line]);
      }
      lineHash[line] = lineStart;
      lineArray[lineStart] = line;
      lineStart++;
      return String.fromCharCode(lineHash[line]);
    })
    .join("");

  return { chars1, chars2, lineArray };
};

/**
 * 计算两个子节点的相似度因子（当前实现固定返回 0，用于在左右端冲突时做选择）
 * @param _node1 节点 1
 * @param _node2 节点 2
 * @returns 相似度因子
 */
export const computeChildEqualityFactor = (_node1, _node2) => {
  return 0;
};

/**
 * 断言两个节点类型相等，不相等则抛出异常
 * @param node1 节点 1
 * @param node2 节点 2
 */
export const assertNodeTypeEqual = (node1, node2) => {
  if (getNodeProperty(node1, "type") !== getNodeProperty(node2, "type")) {
    throw new Error(`node type not equal: ${node1.type} !== ${node2.type}`);
  }
};

/**
 * 将值包装为数组：已是数组则原样返回，否则包一层
 * @param value 输入值
 * @returns 数组
 */
export const ensureArray = (value) => {
  return Array.isArray(value) ? value : [value];
};

/**
 * 深度比较两个节点（或节点数组）是否相等
 * 比较维度：类型、文本内容、属性、marks、子节点
 * @param node1 节点 1
 * @param node2 节点 2
 * @returns 是否相等
 */
export const isNodeEqual = (node1, node2) => {
  const isNode1Array = Array.isArray(node1);
  const isNode2Array = Array.isArray(node2);
  if (isNode1Array !== isNode2Array) {
    return false;
  }
  if (isNode1Array) {
    return (
      node1.length === node2.length &&
      node1.every((node, index) => isNodeEqual(node, node2[index]))
    );
  }

  const type1 = getNodeProperty(node1, "type");
  const type2 = getNodeProperty(node2, "type");
  if (type1 !== type2) {
    return false;
  }
  if (isTextNode(node1)) {
    const text1 = getNodeProperty(node1, "text");
    const text2 = getNodeProperty(node2, "text");
    if (text1 !== text2) {
      return false;
    }
  }
  const attrs1 = getNodeAttributes(node1);
  const attrs2 = getNodeAttributes(node2);
  const attrs = [...new Set([...Object.keys(attrs1), ...Object.keys(attrs2)])];
  for (const attr of attrs) {
    if (attrs1[attr] !== attrs2[attr]) {
      return false;
    }
  }
  const marks1 = getNodeMarks(node1);
  const marks2 = getNodeMarks(node2);
  if (marks1.length !== marks2.length) {
    return false;
  }
  for (let i = 0; i < marks1.length; i++) {
    if (!isNodeEqual(marks1[i], marks2[i])) {
      return false;
    }
  }
  const children1 = getNodeChildren(node1);
  const children2 = getNodeChildren(node2);
  if (children1.length !== children2.length) {
    return false;
  }
  for (let i = 0; i < children1.length; i++) {
    if (!isNodeEqual(children1[i], children2[i])) {
      return false;
    }
  }
  return true;
};

/**
 * 规范化节点子内容：连续的文本节点合并为数组元素，块节点保持为单元素
 * @param node 待规范化的节点
 * @returns 规范化后的子节点数组（元素可能是 Node 或 Node[]）
 */
export const normalizeNodeContent = (node) => {
  const content = getNodeChildren(node) ?? [];
  const res = [];
  for (let i = 0; i < content.length; i++) {
    const child = content[i];
    if (isTextNode(child)) {
      const textNodes = [];
      for (
        let textNode = content[i];
        i < content.length && isTextNode(textNode);
        textNode = content[++i]
      ) {
        textNodes.push(textNode);
      }
      i--;
      res.push(textNodes);
    } else {
      res.push(child);
    }
  }
  return res;
};

/**
 * 读取节点指定属性值；type 特殊处理为 type.name
 * @param node 节点
 * @param property 属性名
 * @returns 属性值
 */
export const getNodeProperty = (node, property) => {
  if (property === "type") {
    return node.type?.name;
  }
  return node[property];
};

/**
 * 读取节点单个 attribute 值
 * @param node 节点
 * @param attribute 属性名
 * @returns 属性值；节点无 attrs 时返回 undefined
 */
export const getNodeAttribute = (node, attribute) =>
  node.attrs ? node.attrs[attribute] : undefined;

/**
 * 读取节点全部 attributes
 * @param node 节点
 * @returns 属性对象；节点无 attrs 时返回空对象
 */
export const getNodeAttributes = (node) => (node.attrs ? node.attrs : {});

/**
 * 读取节点的 marks 数组
 * @param node 节点
 * @returns marks 数组；无 marks 时返回空数组
 */
export const getNodeMarks = (node) => node.marks ?? [];

/**
 * 读取节点的子节点数组
 * @param node 节点
 * @returns 子节点数组；无 content 时返回空数组
 */
export const getNodeChildren = (node) => node.content?.content ?? [];

/**
 * 读取文本节点的文本内容
 * @param node 文本节点
 * @returns 文本字符串
 */
export const getNodeText = (node) => node.text;

/**
 * 判断节点是否为文本节点
 * @param node 节点
 * @returns 是否为文本节点
 */
export const isTextNode = (node) => node.type?.name === "text";

/**
 * 判断两个节点类型是否匹配（type.name 相同，或同为数组）
 * @param node1 节点 1
 * @param node2 节点 2
 * @returns 类型是否匹配
 */
export const matchNodeType = (node1, node2) =>
  node1.type?.name === node2.type?.name ||
  (Array.isArray(node1) && Array.isArray(node2));

/**
 * 基于旧节点创建新节点，复用其 type/attrs/marks 并替换子节点
 * @param oldNode 旧节点（提供 type/attrs/marks）
 * @param children 新的子节点数组
 * @returns 新的 Node 实例
 */
export const createNewNode = (oldNode, children) => {
  if (!oldNode.type) {
    throw new Error("oldNode.type is undefined");
  }
  return new Node(
    oldNode.type,
    oldNode.attrs,
    Fragment.fromArray(children),
    oldNode.marks
  );
};

/**
 * 为节点及其后代文本节点添加差异标记（diffMark）
 * @param schema ProseMirror schema
 * @param node 待标记节点
 * @param type 差异类型（Inserted / Deleted）
 * @returns 带 diffMark 的新节点
 */
export const createDiffNode = (schema, node, type) => {
  return mapDocumentNode(node, (currentNode) => {
    if (isTextNode(currentNode)) {
      return createTextNode(schema, getNodeText(currentNode), [
        ...(currentNode.marks || []),
        createDiffMark(schema, type),
      ]);
    }
    return currentNode;
  });
};

/**
 * 深度遍历节点并对每个节点执行 mapper，返回映射后的新节点树
 * @param node 源节点
 * @param mapper 节点映射函数，返回 falsy 时保留原节点
 * @returns 映射后的节点
 */
function mapDocumentNode(node, mapper) {
  const copy = node.copy(
    Fragment.from(
      node.content.content
        .map((currentNode) => mapDocumentNode(currentNode, mapper))
        .filter((n) => n)
    )
  );
  return mapper(copy) || copy;
}

/**
 * 创建差异标记 mark
 * @param schema ProseMirror schema
 * @param type 差异类型（仅支持 Inserted / Deleted）
 * @returns diffMark mark 实例
 */
export const createDiffMark = (schema, type) => {
  if (type === DiffType.Inserted) {
    return schema.mark("diffMark", { type });
  }
  if (type === DiffType.Deleted) {
    return schema.mark("diffMark", { type });
  }
  throw new Error("type is not valid");
};

/**
 * 创建带 marks 的文本节点
 * @param schema ProseMirror schema
 * @param content 文本内容
 * @param marks marks 数组，默认为空
 * @returns 文本节点
 */
export const createTextNode = (schema, content, marks = []) => {
  return schema.text(content, marks);
};

/**
 * 编辑器文档差异入口：将新旧 JSON 文档转换为节点后计算差异
 * @param schema ProseMirror schema
 * @param oldDoc 旧文档 JSON
 * @param newDoc 新文档 JSON
 * @returns 带差异标记的合并节点
 */
export const diffEditor = (schema, oldDoc, newDoc) => {
  const oldNode = Node.fromJSON(schema, oldDoc);
  const newNode = Node.fromJSON(schema, newDoc);
  return patchDocumentNode(schema, oldNode, newNode);
};
