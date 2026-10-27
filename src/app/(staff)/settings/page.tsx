import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { requireStaff } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("settings") };
}

export default async function SettingsPage() {
  await requireStaff();
  const t = await getTranslations();
  return (
    <>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{t("nav.settings")}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/settings/staff" className="block rounded-xl border border-line bg-surface p-4 hover:border-muted">
          <b>{t("staff.title")}</b>
          <p className="text-sm text-muted">{t("staff.inviteSub")}</p>
        </Link>
        <Card>
          <b>{t("soon.title")}</b>
          <p className="text-sm text-muted">{t("soon.text", { phase: 11 })}</p>
        </Card>
      </div>
    </>
  );
}
