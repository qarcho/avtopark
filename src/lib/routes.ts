// Pages anyone can open without logging in.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth/confirm", "/auth/error"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Only allow redirects to our own pages (prevents open-redirect tricks in email links). */
export function safeNextPath(next: string | null | undefined, fallback = "/today"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
