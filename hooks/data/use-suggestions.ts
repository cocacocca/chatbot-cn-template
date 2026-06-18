/** @file 建议列表 Hook，基于 SWR 拉取指定文档的推荐建议 */
"use client";

import useSWR from "swr";
import { getSuggestions } from "@/lib/queries/client/suggestion-queries";
import type { Suggestion } from "@/lib/types";

/**
 * 建议 Hook
 *
 * 根据文档 ID 与创建时间拉取对应的建议列表，
 * SWR key 同时包含两个参数，任一变化都会重新拉取。
 *
 * @param documentId 文档 ID
 * @param documentCreatedAt 文档创建时间
 * @returns SWR 返回值，包含建议数组及加载/错误状态
 */
export function useSuggestions(documentId: string, documentCreatedAt: string) {
  return useSWR<Suggestion[]>(
    ["suggestions", documentId, documentCreatedAt],
    () => getSuggestions(documentId, documentCreatedAt)
  );
}
