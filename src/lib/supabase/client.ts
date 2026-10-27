import { createBrowserClient } from "@supabase/ssr";

/** Supabase client in the browser, acting as the logged-in user. Stores the session in cookies. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    // We read invite links ourselves (see /auth/accept), so the library must not try to.
    auth: { detectSessionInUrl: false },
  });
}
