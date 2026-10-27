import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "email", "email_change"];

// Links in invite and password-reset emails land here. We verify the one-time
// token, which logs the person in, then send them on to set their password.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/auth/error", request.url));
}
