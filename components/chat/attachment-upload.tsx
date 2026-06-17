"use client";

import { uploadChatAttachment } from "@/lib/storage/client";

export function AttachmentUpload({
  chatId,
  onUploaded,
}: {
  chatId: string;
  onUploaded: (attachment: { path: string; url: string }) => void;
}) {
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const result = await uploadChatAttachment(file, chatId);
      onUploaded(result);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <input
      accept="image/jpeg,image/png"
      onChange={handleFileChange}
      type="file"
    />
  );
}
