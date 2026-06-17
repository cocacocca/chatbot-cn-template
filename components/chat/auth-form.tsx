"use client";

import { motion } from "framer-motion";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SubmitButton } from "./submit-button";
import { toast } from "./toast";

const fieldSpring = { type: "spring" as const, damping: 25, stiffness: 300 };

export function AuthForm({
  mode,
  defaultEmail = "",
}: {
  mode: "login" | "register";
  defaultEmail?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isSuccessful, setIsSuccessful] = useState(false);

  const showName = mode === "register";

  async function action(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({ type: "error", description: "邮箱或密码不正确" });
        return;
      }

      setIsSuccessful(true);
      router.push("/");
      router.refresh();
    } else {
      const name = formData.get("name") as string;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (error) {
        const description = error.message.toLowerCase().includes("already")
          ? "该邮箱已被注册"
          : "注册失败，请稍后重试";
        toast({ type: "error", description });
        return;
      }

      toast({ type: "success", description: "注册成功！" });
      setIsSuccessful(true);
      router.push("/");
      router.refresh();
    }
  }

  return (
    <Form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        {showName && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-1.5"
            initial={{ opacity: 0, y: 10 }}
            transition={{ ...fieldSpring, delay: 0.05 }}
          >
            <Label
              className="text-[13px] font-medium text-[var(--color-foreground)]"
              htmlFor="name"
            >
              用户名
            </Label>
            <Input
              autoComplete="name"
              className="h-9 rounded-lg border-[var(--color-border)] bg-transparent text-sm shadow-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--color-foreground)]/20"
              id="name"
              name="name"
              placeholder="你的昵称"
              required
            />
          </motion.div>
        )}

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1.5"
          initial={{ opacity: 0, y: 10 }}
          transition={{ ...fieldSpring, delay: showName ? 0.1 : 0.05 }}
        >
          <Label
            className="text-[13px] font-medium text-[var(--color-foreground)]"
            htmlFor="email"
          >
            邮箱
          </Label>
          <Input
            autoComplete="email"
            autoFocus
            className="h-9 rounded-lg border-[var(--color-border)] bg-transparent text-sm shadow-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--color-foreground)]/20"
            defaultValue={defaultEmail}
            id="email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </motion.div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1.5"
          initial={{ opacity: 0, y: 10 }}
          transition={{ ...fieldSpring, delay: showName ? 0.15 : 0.1 }}
        >
          <Label
            className="text-[13px] font-medium text-[var(--color-foreground)]"
            htmlFor="password"
          >
            密码
          </Label>
          <Input
            className="h-9 rounded-lg border-[var(--color-border)] bg-transparent text-sm shadow-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--color-foreground)]/20"
            id="password"
            name="password"
            placeholder="至少 6 位字符"
            required
            type="password"
          />
        </motion.div>
      </div>

      <SubmitButton isSuccessful={isSuccessful}>
        {mode === "login" ? "登录" : "注册"}
      </SubmitButton>
    </Form>
  );
}
