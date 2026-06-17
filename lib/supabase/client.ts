import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
