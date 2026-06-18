"use client";

import useSWR from "swr";
import {
  getDocumentsByDocumentId,
  getLatestDocument,
} from "@/lib/queries/client/document-queries";
import type { Document } from "@/lib/types";

export function useDocuments(documentId: string) {
  return useSWR<Document[]>(["documents", documentId], () =>
    getDocumentsByDocumentId(documentId)
  );
}

export function useLatestDocument(documentId: string) {
  return useSWR<Document>(["document-latest", documentId], () =>
    getLatestDocument(documentId)
  );
}
