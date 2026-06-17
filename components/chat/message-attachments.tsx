"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getAttachmentUrls } from "@/lib/storage/client";

export function MessageAttachments({
  attachments,
}: {
  attachments: Array<{ path: string; type: string }>;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (attachments.length === 0) {
      return;
    }
    const paths = attachments.map((a) => a.path);
    getAttachmentUrls(paths).then(setUrls);
  }, [attachments]);

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2">
      {attachments.map((att) => (
        <Image
          alt="attachment"
          className="max-w-32 max-h-32 rounded"
          height={128}
          key={att.path}
          src={urls[att.path]}
          width={128}
        />
      ))}
    </div>
  );
}
