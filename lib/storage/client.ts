"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * @file 聊天附件存储客户端
 *
 * 封装 Supabase Storage 中 `cct-chat-attachments` 存储桶的上传与签名 URL 生成逻辑。
 * 所有操作基于浏览器客户端（anon 密钥），受 RLS 策略约束：
 * 用户仅能操作自己目录（`{userId}/...`）下的文件。
 */

/** 允许上传的文件 MIME 类型白名单 */
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

/** 单个文件大小上限：5MB */
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * 上传聊天附件到存储桶并返回签名 URL
 *
 * 处理流程：
 * 1. 校验文件类型（仅允许 JPEG/PNG）与大小（≤ 5MB）
 * 2. 获取当前登录用户，未登录则抛错
 * 3. 生成唯一文件名，路径格式：`{userId}/{chatId}/{timestamp}_{random}.{ext}`
 * 4. 上传至 `cct-chat-attachments` 存储桶（禁止覆盖同名文件）
 * 5. 生成 1 小时有效的签名 URL
 *
 * @param file - 待上传的文件对象
 * @param chatId - 所属聊天会话 ID，用于隔离不同会话的附件
 * @returns 包含存储路径 `path` 与签名 URL `url` 的对象
 * @throws {Error} 文件类型不允许 / 文件过大 / 未登录
 * @throws {PostgrestError} 上传失败时抛出原始错误
 */
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

  // 生成唯一文件名：时间戳 + 随机串，保留原始扩展名
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  // 存储路径按 用户/会话 分层，便于 RLS 策略基于路径前缀鉴权
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

  // 生成 1 小时（3600 秒）有效的签名 URL，客户端可据此下载文件
  const { data: urlData } = await supabase.storage
    .from("cct-chat-attachments")
    .createSignedUrl(filePath, 3600);

  return {
    path: filePath,
    url: urlData?.signedUrl ?? "",
  };
}

/**
 * 批量获取附件的签名 URL
 *
 * 为给定的存储路径列表批量生成 1 小时有效的签名 URL。
 * 仅返回成功生成签名 URL 的条目，失败项会被静默跳过。
 *
 * @param paths - 存储路径数组，格式如 `["userId/chatId/file1.jpg", ...]`
 * @returns 路径到签名 URL 的映射对象 `{ [path]: signedUrl }`
 */
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
