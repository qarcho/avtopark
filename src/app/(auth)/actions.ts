"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { authRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, forgotPasswordSchema, formObject, loginSchema, newPasswordSchema } from "@/lib/validation";

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formObject(form));
  const values = { email: String(form.get("email") ?? "") };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  if (!(await authRateLimit("login", parsed.data.email))) {
    return { message: "auth.tooManyAttempts", values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Same message whether the email exists or not.
    return { message: "auth.invalidCredentials", values };
  }
  redirect("/today");
}

export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(formObject(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { email: String(form.get("email") ?? "") } };

  if (await authRateLimit("reset", parsed.data.email)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/set-password`,
    });
    if (error && error.status !== 429) console.error("password reset failed", error.code);
  }
  // Always the same answer, so nobody can find out which emails have accounts.
  return { ok: true, message: "auth.linkSent" };
}

export async function setPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(formObject(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { message: "generic" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") return { errors: { password: "weak_password" } };
    if (error.code === "same_password") return { ok: true, message: "auth.passwordSaved" };
    console.error("set password failed", error.code);
    return { message: "generic" };
  }
  redirect("/today");
}
