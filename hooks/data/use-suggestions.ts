"use client";

import useSWR from "swr";
import { getSuggestions } from "@/lib/queries/client/suggestion-queries";
import type { Suggestion } from "@/lib/types";

export function useSuggestions(documentId: string, documentCreatedAt: string) {
  return useSWR<Suggestion[]>(
    ["suggestions", documentId, documentCreatedAt],
    () => getSuggestions(documentId, documentCreatedAt)
  );
}
