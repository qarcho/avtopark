"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/app/actions";
import { LOCALES } from "@/i18n/config";

const LABELS = { ka: "ქარ", en: "ENG" } as const;

export function LanguageSwitch() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div role="group" aria-label={t("language")} className="flex overflow-hidden rounded-lg border border-line">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setLocale(l);
              router.refresh();
            })
          }
          className="min-h-9 px-3 text-xs font-bold text-muted aria-pressed:bg-ink aria-pressed:text-surface"
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
