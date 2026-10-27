import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "email", "email_change"];

// Links in password-reset emails land here, then go on to set a new password.
// Two link styles are accepted:
// - "?code=…": Supabase's standard email template. Works only in the browser where the
//   reset was requested (it holds the matching secret in a cookie).
// - "?token_hash=…&type=…": our own templates (planned together with the email service).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/auth/error", request.url));
}
