/** @file 鉴权守卫 Hook，未登录用户自动重定向至登录页 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "./use-user";

/**
 * 鉴权守卫 Hook
 *
 * 在需要登录才能访问的页面中使用，当用户未登录且加载完成时，
 * 自动重定向至 `/login` 登录页。
 *
 * @returns 当前用户信息与加载状态
 */
export function useRequireAuth() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // 加载完成且未检测到登录用户时跳转登录页
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  return { user, loading };
}
