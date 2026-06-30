/** @file 用户身份与资料 Hook，基于 Supabase Auth 提供实时同步的登录状态 */
"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { UserProfile } from "@/lib/queries/client/types";
import { getProfile } from "@/lib/queries/client/user-queries";
import { createClient } from "@/lib/supabase/client";

/**
 * 用户身份与资料 Hook
 *
 * 通过 Supabase 客户端获取当前登录用户及其业务资料，
 * 并订阅鉴权状态变化以保持登录信息实时同步。
 *
 * @returns 用户对象、用户资料以及加载状态
 */
export function useUser() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 防止组件卸载后继续写入状态
    let mounted = true;

    /**
     * 加载当前登录用户及其业务资料
     */
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) {
        return;
      }

      setUser(user);
      setLoading(false);

      if (user) {
        // 已登录用户额外拉取业务侧资料
        const profileData = await getProfile();
        if (mounted) {
          setProfile(profileData);
        }
      } else {
        setProfile(null);
      }
    }

    loadUser();

    // 订阅鉴权状态变化，实时同步登录信息
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return { user, profile, loading };
}
