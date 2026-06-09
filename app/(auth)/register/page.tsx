"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { AuthForm } from "@/components/chat/auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { type RegisterActionState, register } from "../actions";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    { status: "idle" }
  );

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "user_exists") {
      toast({ type: "error", description: "该邮箱已被注册" });
    } else if (state.status === "failed") {
      toast({ type: "error", description: "注册失败，请稍后重试" });
    } else if (state.status === "invalid_data") {
      toast({ type: "error", description: "请检查输入格式" });
    } else if (state.status === "success") {
      toast({ type: "success", description: "注册成功！" });
      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state.status]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <>
      <motion.div
        animate={{ opacity: 1 }}
        className="mb-6 flex flex-col gap-1.5"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-lg font-semibold tracking-tight">注册</h1>
        <p className="text-[13px] text-[var(--color-muted-foreground)]">
          创建账户，开始使用
        </p>
      </motion.div>

      <AuthForm action={handleSubmit} defaultEmail={email} showName>
        <SubmitButton isSuccessful={isSuccessful}>注册</SubmitButton>
      </AuthForm>

      <motion.p
        animate={{ opacity: 1 }}
        className="mt-6 text-center text-[13px] text-[var(--color-muted-foreground)]"
        initial={{ opacity: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        已有账户？{" "}
        <Link
          className="text-[var(--color-foreground)] underline underline-offset-4 decoration-[var(--color-border)] hover:decoration-[var(--color-foreground)] transition-colors"
          href="/login"
        >
          登录
        </Link>
      </motion.p>
    </>
  );
}
