"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { updateChatVisibility } from "@/app/(chat)/actions";
import { getChatHistoryPaginationKey } from "@/components/chat/sidebar-history";
import type { VisibilityType } from "@/components/chat/visibility-selector";

export function useChatVisibility({
  chatId,
  initialVisibilityType,
}: {
  chatId: string;
  initialVisibilityType: VisibilityType;
}) {
  const { mutate } = useSWRConfig();
  const [localVisibility, setLocalVisibility] = useState<VisibilityType>(
    initialVisibilityType
  );

  const setVisibilityType = (updatedVisibilityType: VisibilityType) => {
    setLocalVisibility(updatedVisibilityType);
    mutate(unstable_serialize(getChatHistoryPaginationKey));

    updateChatVisibility({
      chatId,
      visibility: updatedVisibilityType,
    });
  };

  return { visibilityType: localVisibility, setVisibilityType };
}
