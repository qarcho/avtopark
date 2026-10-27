import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Limits are counted in the database, so they work across all server instances.
// Keys are hashed: we never store raw IP addresses or emails for this.

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Returns true if the action is allowed. Fails open only if the database is unreachable. */
export async function rateLimit(action: string, subject: string, max: number, windowSeconds: number) {
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: `${action}:${hash(subject)}`,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.code);
    return true;
  }
  return data === true;
}

/** Login and password reset: per IP and per email, 10 tries per 15 minutes each. */
export async function authRateLimit(action: "login" | "reset", email: string) {
  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`${action}:ip`, ip, 30, 15 * 60),
    rateLimit(`${action}:email`, email, 10, 15 * 60),
  ]);
  return byIp && byEmail;
}
