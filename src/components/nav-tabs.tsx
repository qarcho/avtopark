"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const TABS = [
  ["/today", "today"],
  ["/fleet", "fleet"],
  ["/calendar", "calendar"],
  ["/customers", "customers"],
  ["/fines", "fines"],
  ["/settings", "settings"],
] as const;

export function NavTabs({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const tabs: (readonly [string, string])[] = isPlatformAdmin ? [...TABS, ["/admin", "admin"]] : [...TABS];

  return (
    <nav aria-label={t("main")} className="mx-auto max-w-6xl px-4">
      <ul className="flex gap-0.5 overflow-x-auto py-1.5 [scrollbar-width:none]">
        {tabs.map(([href, key]) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-9 items-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap text-muted hover:bg-sunk aria-[current=page]:bg-sunk aria-[current=page]:text-ink"
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
