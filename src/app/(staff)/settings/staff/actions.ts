"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { env } from "@/lib/env";
import { INVITE_LANDING_PATH } from "@/lib/routes";
import { success, type FormState } from "@/lib/form-state";
import { assignableRoles, can, canManageMember, type Role } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { changeRoleSchema, fieldErrors, formObject, inviteStaffSchema, removeStaffSchema } from "@/lib/validation";

const PATH = "/settings/staff";

export async function inviteStaff(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireStaff();
  const { organizationId, role: myRole } = ctx.current;
  const values = { fullName: String(form.get("fullName") ?? ""), email: String(form.get("email") ?? ""), role: String(form.get("role") ?? "") };
  if (!can(myRole, "manage_staff")) return { message: "forbidden", values };

  const parsed = inviteStaffSchema.safeParse(formObject(form));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const { email, fullName, role } = parsed.data;
  if (!assignableRoles(myRole).includes(role)) return { message: "forbidden", values };
  if (!(await rateLimit("invite", ctx.userId, 30, 60 * 60))) return { message: "auth.tooManyAttempts", values };

  const admin = createAdminClient();
  const supabase = await createClient();

  const { data: existingId, error: findError } = await admin.rpc("find_user_id_by_email", { p_email: email });
  if (findError) return { message: "generic", values };

  if (existingId) {
    const { data: already } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", existingId)
      .maybeSingle();
    if (already) return { errors: { email: "already_member" }, values };
    // Inserted as the manager, so database rules double-check the permission.
    const { error } = await supabase.from("memberships").insert({ organization_id: organizationId, user_id: existingId, role });
    if (error) return { message: "generic", values };
    revalidatePath(PATH);
    return success("staff.addedExisting");
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}${INVITE_LANDING_PATH}`,
  });
  if (inviteError || !invited.user) {
    console.error("invite failed", inviteError?.code);
    return { message: "generic", values };
  }
  const { error } = await supabase.from("memberships").insert({ organization_id: organizationId, user_id: invited.user.id, role });
  if (error) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return { message: "generic", values };
  }
  revalidatePath(PATH);
  return success("staff.invited");
}

async function targetRole(organizationId: string, userId: string): Promise<Role | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as Role | undefined) ?? null;
}

export async function changeRole(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireStaff();
  const { organizationId, role: myRole } = ctx.current;
  const parsed = changeRoleSchema.safeParse(formObject(form));
  if (!parsed.success) return { message: "generic" };
  const { userId, role } = parsed.data;
  if (userId === ctx.userId) return { message: "forbidden" };

  const current = await targetRole(organizationId, userId);
  if (!current || !canManageMember(myRole, current) || !assignableRoles(myRole).includes(role)) return { message: "forbidden" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("memberships")
    .update({ role }, { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("user_id", userId);
  if (error) return { message: error.message.includes("at least one owner") ? "last_owner" : "generic" };
  if (!count) return { message: "forbidden" };
  revalidatePath(PATH);
  return success("staff.roleChanged");
}

export async function removeStaff(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireStaff();
  const { organizationId, role: myRole } = ctx.current;
  const parsed = removeStaffSchema.safeParse(formObject(form));
  if (!parsed.success) return { message: "generic" };
  const { userId } = parsed.data;
  if (userId === ctx.userId) return { message: "forbidden" };

  const current = await targetRole(organizationId, userId);
  if (!current || !canManageMember(myRole, current)) return { message: "forbidden" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("memberships")
    .delete({ count: "exact" })
    .eq("organization_id", organizationId)
    .eq("user_id", userId);
  if (error) return { message: error.message.includes("at least one owner") ? "last_owner" : "generic" };
  if (!count) return { message: "forbidden" };
  revalidatePath(PATH);
  return success("staff.removed");
}
