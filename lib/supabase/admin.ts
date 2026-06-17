import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createAdminClient() {
  return createClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars are required at runtime
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
