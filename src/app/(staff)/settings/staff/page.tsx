import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { assignableRoles, can, canManageMember, ROLES, type Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";
import { MemberActions } from "./member-actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("staff"))("title") };
}

const ROLE_TONE = { owner: "info", manager: "accent", operator: "ok" } as const;

export default async function StaffPage() {
  const ctx = await requireStaff();
  const t = await getTranslations();
  const supabase = await createClient();
  const { organizationId, role: myRole, organizationName } = ctx.current;

  const { data } = await supabase
    .from("memberships")
    .select("user_id, role, created_at, profiles(full_name, email)")
    .eq("organization_id", organizationId)
    .order("created_at");

  const order: Record<Role, number> = { owner: 0, manager: 1, operator: 2 };
  const staff = (data ?? [])
    .map((m) => {
      const p = m.profiles as unknown as { full_name: string; email: string } | null;
      return { userId: m.user_id as string, role: m.role as Role, name: p?.full_name ?? "", email: p?.email ?? "" };
    })
    .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));

  const manages = can(myRole, "manage_staff");
  const roleOptions = assignableRoles(myRole).map((r) => ({ value: r, label: t(`roles.${r}`) }));

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("staff.title")}</h1>
        <p className="text-muted">{t("staff.sub", { company: organizationName })}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="p-0">
          <ul>
            {staff.map((s) => {
              const isMe = s.userId === ctx.userId;
              const editable = manages && !isMe && canManageMember(myRole, s.role);
              return (
                <li key={s.userId} className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">
                      {s.name || s.email}
                      {isMe && <span className="font-normal text-muted"> ({t("common.you")})</span>}
                    </div>
                    <div className="truncate text-sm text-muted">{s.email}</div>
                  </div>
                  {editable ? (
                    <MemberActions userId={s.userId} role={s.role} roleOptions={roleOptions} />
                  ) : (
                    <Pill tone={ROLE_TONE[s.role]}>{t(`roles.${s.role}`)}</Pill>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          {manages ? (
            <Card>
              <SectionTitle>{t("staff.invite")}</SectionTitle>
              <p className="mb-3 text-sm text-muted">{t("staff.inviteSub")}</p>
              <InviteForm roleOptions={roleOptions} />
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-muted">{t("staff.onlyManagers")}</p>
            </Card>
          )}
          <Card>
            <SectionTitle>{t("staff.rolesTitle")}</SectionTitle>
            <dl className="flex flex-col gap-2 text-sm">
              {ROLES.map((r) => (
                <div key={r}>
                  <dt className="font-bold">{t(`roles.${r}`)}</dt>
                  <dd className="text-muted">{t(`roles.${r}Help`)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
