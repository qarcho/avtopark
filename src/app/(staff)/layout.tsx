import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/actions";
import { LanguageSwitch } from "@/components/language-switch";
import { Logo } from "@/components/logo";
import { NavTabs } from "@/components/nav-tabs";
import { OrgSwitch } from "@/components/org-switch";
import { requireStaff } from "@/lib/auth";

export default async function StaffLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireStaff();
  const t = await getTranslations();

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        {t("app.skipToContent")}
      </a>
      <header className="sticky top-0 z-10 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="mr-auto flex min-w-0 items-center gap-2.5">
            <Logo />
            <div className="min-w-0 leading-tight">
              <b className="block text-base font-extrabold tracking-tight">{t("app.brand")}</b>
              <OrgSwitch memberships={ctx.memberships} currentId={ctx.current.organizationId} label={t("nav.company")} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-9 rounded-lg border border-line px-3 text-xs font-bold text-muted hover:border-muted"
                title={ctx.email}
              >
                {t("nav.signOut")}
              </button>
            </form>
          </div>
        </div>
        <div className="border-t border-line">
          <NavTabs isPlatformAdmin={ctx.isPlatformAdmin} />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pt-5 pb-16">
        {children}
      </main>
    </div>
  );
}
