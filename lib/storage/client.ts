"use client";

import { createClient } from "@/lib/supabase/client";

const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadChatAttachment(
  file: File,
  chatId: string
): Promise<{ path: string; url: string }> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("仅支持 JPEG/PNG 格式");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("文件大小不能超过 5MB");
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("未登录");
  }

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `${user.id}/${chatId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("cct-chat-attachments")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: urlData } = await supabase.storage
    .from("cct-chat-attachments")
    .createSignedUrl(filePath, 3600);

  return {
    path: filePath,
    url: urlData?.signedUrl ?? "",
  };
}

export async function getAttachmentUrls(
  paths: string[]
): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data } = await supabase.storage
    .from("cct-chat-attachments")
    .createSignedUrls(paths, 3600);

  const result: Record<string, string> = {};
  data?.forEach((item, index) => {
    if (item.signedUrl) {
      result[paths[index]] = item.signedUrl;
    }
  });
  return result;
}
