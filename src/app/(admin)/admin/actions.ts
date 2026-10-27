"use server";

import { revalidatePath } from "next/cache";
import { isPlatformAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { INVITE_LANDING_PATH } from "@/lib/routes";
import { success, type FormState } from "@/lib/form-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrganizationSchema, fieldErrors, formObject } from "@/lib/validation";

/**
 * Platform admin creates a rental company and invites its owner.
 * Uses the secret key (companies cannot create themselves), so the admin check comes first.
 */
export async function createOrganization(_prev: FormState, form: FormData): Promise<FormState> {
  const values = formObject(form);
  if (!(await isPlatformAdmin())) return { message: "forbidden", values };

  const parsed = createOrganizationSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const { name, slug, ownerName, ownerEmail } = parsed.data;

  const admin = createAdminClient();
  const { data: org, error: orgError } = await admin.from("organizations").insert({ name, slug }).select("id").single();
  if (orgError) {
    if (orgError.code === "23505") return { errors: { slug: "slug_taken" }, values };
    console.error("create organization failed", orgError.code);
    return { message: "generic", values };
  }

  const fail = async () => {
    await admin.from("organizations").delete().eq("id", org.id);
    return { message: "generic", values } satisfies FormState;
  };

  let ownerId: string | null = null;
  const { data: existingId } = await admin.rpc("find_user_id_by_email", { p_email: ownerEmail });
  if (existingId) {
    ownerId = existingId as string;
  } else {
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(ownerEmail, {
      data: { full_name: ownerName },
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL}${INVITE_LANDING_PATH}`,
    });
    if (error || !invited.user) {
      console.error("owner invite failed", error?.code);
      return fail();
    }
    ownerId = invited.user.id;
  }

  const { error: memberError } = await admin.from("memberships").insert({ organization_id: org.id, user_id: ownerId, role: "owner" });
  if (memberError) return fail();

  revalidatePath("/admin");
  return success("admin.created");
}
