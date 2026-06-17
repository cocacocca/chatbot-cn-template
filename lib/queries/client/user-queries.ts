import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "./types";

// 获取当前用户 profile（email 来自 auth user，其余来自 cct_user_profile）
export async function getProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("cct_user_profile")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // 未找到 profile 记录
      return null;
    }
    throw error;
  }

  return {
    id: data.id,
    email: user.email ?? "",
    name: data.name,
    image: data.image,
    createdAt: data.created_at,
  };
}

// 更新 profile
export async function updateProfile(
  updates: Partial<Pick<UserProfile, "name" | "image">>
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const updateData: {
    name?: string | null;
    image?: string | null;
  } = {};
  if (updates.name !== undefined) {
    updateData.name = updates.name;
  }
  if (updates.image !== undefined) {
    updateData.image = updates.image;
  }

  const { error } = await supabase
    .from("cct_user_profile")
    .update(updateData)
    .eq("id", user.id);
  if (error) {
    throw error;
  }
}
