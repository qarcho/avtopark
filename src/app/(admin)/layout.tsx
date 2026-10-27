import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/actions";
import { LanguageSwitch } from "@/components/language-switch";
import { Logo } from "@/components/logo";
import { getMemberships, requirePlatformAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  await requirePlatformAdmin();
  const t = await getTranslations();
  const hasCompany = (await getMemberships()).length > 0;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="mr-auto flex items-center gap-2.5">
            <Logo />
            <div className="leading-tight">
              <b className="block text-base font-extrabold">{t("app.brand")}</b>
              <small className="text-xs text-muted">{t("nav.admin")}</small>
            </div>
          </div>
          {hasCompany && (
            <Link href="/today" className="text-sm font-semibold text-accent">
              {t("nav.today")}
            </Link>
          )}
          <LanguageSwitch />
          <form action={signOut}>
            <button type="submit" className="min-h-9 rounded-lg border border-line px-3 text-xs font-bold text-muted hover:border-muted">
              {t("nav.signOut")}
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pt-5 pb-16">
        {children}
      </main>
    </div>
  );
}
