import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";

export async function ComingSoon({ titleKey, phase }: { titleKey: string; phase: number }) {
  const t = await getTranslations();
  return (
    <>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{t(titleKey)}</h1>
      <Card>
        <p className="font-bold">{t("soon.title")}</p>
        <p className="text-muted">{t("soon.text", { phase })}</p>
      </Card>
    </>
  );
}
