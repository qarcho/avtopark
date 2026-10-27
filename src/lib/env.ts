import { z } from "zod";

// Public values are inlined at build time, so they must be read as literal property accesses.
const publicEnv = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z
      .url()
      .refine((u) => new URL(u).pathname === "/", "NEXT_PUBLIC_SUPABASE_URL must be just https://xxxx.supabase.co (no /rest/v1)"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
    NEXT_PUBLIC_SITE_URL: z.url(),
  })
  .parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

export const env = publicEnv;

/** Server-only secret. Throws if called where it is missing. */
export function secretKey(): string {
  return z.string().min(20, "SUPABASE_SECRET_KEY is missing").parse(process.env.SUPABASE_SECRET_KEY);
}
