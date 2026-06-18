/** @file 认证路由组（auth）的布局组件，提供登录/注册页面的统一外观与切换动画 */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { SparklesIcon } from "@/components/chat/icons";

/**
 * 带切换动画的卡片容器
 * 根据当前路径（pathname）作为 key 触发 AnimatePresence 的进入/退出动画，
 * 实现 login ↔ register 页面切换时的横向滑动过渡效果。
 */
function AnimatedCard({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className="px-6 py-8"
          exit={{ opacity: 0, x: -20 }}
          initial={{ opacity: 0, x: 20 }}
          key={pathname}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * 认证布局组件
 * 居中展示 Logo 与卡片容器，卡片内部根据路径渲染对应的登录或注册表单。
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="flex w-full max-w-[380px] flex-col items-center">
        {/* Logo：点击返回首页 */}
        <Link
          className="mb-8 flex size-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-background)] shadow-sm transition-shadow hover:shadow-md"
          href="/"
        >
          <SparklesIcon size={18} />
        </Link>

        <Suspense>
          <AnimatedCard pathname={pathname}>{children}</AnimatedCard>
        </Suspense>
      </div>
    </div>
  );
}
