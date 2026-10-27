import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, SectionTitle } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CreateOrgForm } from "./create-org-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin"))("title") };
}

export default async function AdminPage() {
  await requirePlatformAdmin();
  const t = await getTranslations("admin");
  const format = await getFormatter();
  // Runs as the admin user: database rules let platform admins read companies and
  // memberships only, never cars, customers or bookings.
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug, created_at, memberships(count)")
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted">{t("sub")}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card className="p-0">
          {orgs && orgs.length > 0 ? (
            <ul>
              {orgs.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-3 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{o.name}</div>
                    <div className="text-sm text-muted">/{o.slug}</div>
                  </div>
                  <div className="text-sm text-muted">
                    {t("colStaff")}: <b className="text-ink tabular-nums">{(o.memberships as unknown as { count: number }[])[0]?.count ?? 0}</b>
                  </div>
                  <div className="text-sm text-muted tabular-nums">{format.dateTime(new Date(o.created_at), { dateStyle: "medium" })}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-muted">{t("empty")}</p>
          )}
        </Card>
        <Card>
          <SectionTitle>{t("create")}</SectionTitle>
          <CreateOrgForm />
        </Card>
      </div>
    </>
  );
}
