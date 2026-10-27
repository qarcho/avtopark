"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/i18n/config";
import { ORG_COOKIE, getMemberships } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localeSchema } from "@/lib/validation";

const YEAR = 60 * 60 * 24 * 365;

export async function setLocale(locale: string) {
  const parsed = localeSchema.safeParse(locale);
  if (!parsed.success) return;
  (await cookies()).set(LOCALE_COOKIE, parsed.data, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

export async function switchOrganization(organizationId: string) {
  const id = z.uuid().safeParse(organizationId);
  if (!id.success) return;
  // Only companies the user really belongs to.
  const memberships = await getMemberships();
  if (!memberships.some((m) => m.organizationId === id.data)) return;
  (await cookies()).set(ORG_COOKIE, id.data, { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: true });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ORG_COOKIE);
  redirect("/login");
}
