import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("calendar") };
}

export default function Page() {
  return <ComingSoon titleKey="nav.calendar" phase={3} />;
}
