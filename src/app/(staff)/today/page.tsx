import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInTbilisi } from "@/lib/dates";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("today"))("title") };
}

export default async function TodayPage() {
  const ctx = await requireStaff();
  const t = await getTranslations();
  const format = await getFormatter();
  const supabase = await createClient();
  const org = ctx.current.organizationId;
  const today = todayInTbilisi();

  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [cars, customers, upcoming, requests] = await Promise.all([
    count(supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", org)),
    count(supabase.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", org)),
    count(
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org)
        .eq("status", "confirmed")
        .gte("pickup_date", today),
    ),
    count(supabase.from("bookings").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("status", "request")),
  ]);

  const name = ctx.fullName.split(" ")[0] || ctx.email;
  const stats = [
    [t("today.cars"), cars],
    [t("today.customers"), customers],
    [t("today.upcoming"), upcoming],
    [t("today.requests"), requests],
  ] as const;

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("today.title")}</h1>
        <p className="text-muted">
          {format.dateTime(new Date(`${today}T12:00:00+04:00`), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
      <Card className="mb-4">
        <p className="text-lg font-bold">{t("today.hello", { name })}</p>
        <p className="text-muted">
          {t("today.youAre", { role: t(`roles.${ctx.current.role}`).toLowerCase(), company: ctx.current.organizationName })}
        </p>
      </Card>
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface px-3.5 py-3">
            <div className="text-xs font-semibold text-muted">{label}</div>
            <div className="mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums">{value}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted">{t("today.foundationNote")}</p>
    </>
  );
}
