import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/permissions";

export const ORG_COOKIE = "avtopark_org";

export type Membership = {
  organizationId: string;
  organizationName: string;
  role: Role;
};

export type StaffContext = {
  userId: string;
  fullName: string;
  email: string;
  isPlatformAdmin: boolean;
  memberships: Membership[];
  /** The company the user is working in right now. */
  current: Membership;
};

/** The logged-in user, or null. Verified with Supabase on every call (cached per request). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return Boolean(data);
});

/** Companies this user works for. Row level security only returns their own memberships' companies. */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", user.id)
    .order("created_at");
  if (error) throw new Error("Could not load memberships");
  return (data ?? []).map((m) => ({
    organizationId: m.organization_id as string,
    organizationName: (m.organizations as unknown as { name: string } | null)?.name ?? "",
    role: m.role as Role,
  }));
});

/**
 * For staff pages: requires login and a company. Sends the user to the right place otherwise.
 * Use the returned `current.organizationId` for every query, and `current.role` for permissions.
 */
export const requireStaff = cache(async (): Promise<StaffContext> => {
  const user = await getUser();
  if (!user) redirect("/login");
  const [memberships, admin] = await Promise.all([getMemberships(), isPlatformAdmin()]);
  if (memberships.length === 0) redirect(admin ? "/admin" : "/no-company");

  const chosen = (await cookies()).get(ORG_COOKIE)?.value;
  const current = memberships.find((m) => m.organizationId === chosen) ?? memberships[0];

  return {
    userId: user.id,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? "",
    email: user.email ?? "",
    isPlatformAdmin: admin,
    memberships,
    current,
  };
});

/** For the platform admin area only. */
export async function requirePlatformAdmin() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await isPlatformAdmin())) redirect("/today");
  return user;
}
