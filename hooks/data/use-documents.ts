/** @file 文档查询 Hook，基于 SWR 拉取文档历史与最新版本 */
"use client";

import useSWR from "swr";
import {
  getDocumentsByDocumentId,
  getLatestDocument,
} from "@/lib/queries/client/document-queries";
import type { Document } from "@/lib/types";

/**
 * 文档列表 Hook
 *
 * 拉取指定文档的全部历史版本。
 *
 * @param documentId 文档 ID
 * @returns SWR 返回值，包含文档历史数组及加载/错误状态
 */
export function useDocuments(documentId: string) {
  return useSWR<Document[]>(["documents", documentId], () =>
    getDocumentsByDocumentId(documentId)
  );
}

/**
 * 最新文档 Hook
 *
 * 拉取指定文档的最新版本，常用于展示当前内容。
 *
 * @param documentId 文档 ID
 * @returns SWR 返回值，包含最新文档及加载/错误状态
 */
export function useLatestDocument(documentId: string) {
  return useSWR<Document>(["document-latest", documentId], () =>
    getLatestDocument(documentId)
  );
}
