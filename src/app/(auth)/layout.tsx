import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { LanguageSwitch } from "@/components/language-switch";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("app");
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6">
      <header className="mx-auto flex w-full max-w-sm items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div className="leading-tight">
            <b className="block text-base font-extrabold">{t("brand")}</b>
            <small className="text-xs text-muted">{t("tagline")}</small>
          </div>
        </div>
        <LanguageSwitch />
      </header>
      <main className="mx-auto mt-10 w-full max-w-sm">{children}</main>
    </div>
  );
}
