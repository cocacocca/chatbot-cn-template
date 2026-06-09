"use client";

import { useFormStatus } from "react-dom";
import { LoaderIcon } from "@/components/chat/icons";
import { Button } from "../ui/button";

export function SubmitButton({
  children,
  isSuccessful,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-disabled={pending || isSuccessful}
      className="h-9 w-full rounded-lg bg-[var(--color-foreground)] text-[var(--color-background)] text-sm font-medium hover:opacity-90"
      disabled={pending || isSuccessful}
      type={pending ? "button" : "submit"}
    >
      {pending || isSuccessful ? (
        <span className="flex items-center gap-2">
          <LoaderIcon className="size-3.5 animate-spin" />
          处理中...
        </span>
      ) : (
        children
      )}

      <output aria-live="polite" className="sr-only">
        {pending || isSuccessful ? "加载中" : "提交表单"}
      </output>
    </Button>
  );
}
