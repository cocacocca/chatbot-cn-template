"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const SignOutForm = () => {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      className="w-full px-1 py-0.5 text-left text-red-500"
      onClick={handleSignOut}
      type="button"
    >
      退出登录
    </button>
  );
};
