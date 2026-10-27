import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, secretKey } from "@/lib/env";

/**
 * Supabase client with the secret key. It BYPASSES all row level security.
 * Use only for things a user cannot do themselves (sending invites, rate limiting,
 * creating companies as platform admin), and always check permissions first.
 */
export function createAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, secretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
