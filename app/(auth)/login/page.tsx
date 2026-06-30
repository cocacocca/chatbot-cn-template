/** @file 登录页面，展示标题、登录表单以及跳转注册的链接 */
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { AuthForm } from "@/components/chat/auth-form";

/**
 * 登录页面组件
 * 渲染「登录」标题、说明文案、登录表单，以及底部跳转到注册页面的链接。
 */
export default function Page() {
  return (
    <>
      <motion.div
        animate={{ opacity: 1 }}
        className="mb-6 flex flex-col gap-1.5"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-lg font-semibold tracking-tight">登录</h1>
        <p className="text-[13px] text-[var(--color-muted-foreground)]">
          登录你的账户以继续使用
        </p>
      </motion.div>

      <AuthForm mode="login" />

      <motion.p
        animate={{ opacity: 1 }}
        className="mt-6 text-center text-[13px] text-[var(--color-muted-foreground)]"
        initial={{ opacity: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        还没有账户？{" "}
        <Link
          className="text-[var(--color-foreground)] underline underline-offset-4 decoration-[var(--color-border)] hover:decoration-[var(--color-foreground)] transition-colors"
          href="/register"
        >
          注册
        </Link>
      </motion.p>
    </>
  );
}
