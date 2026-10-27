import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";

export default async function AuthErrorPage() {
  const t = await getTranslations("auth");
  return (
    <Card className="p-6">
      <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
        {t("linkInvalid")}
      </p>
      <div className="mt-4 flex flex-col gap-2 text-center text-sm font-semibold">
        <Link href="/forgot-password" className="text-accent underline-offset-4 hover:underline">
          {t("forgotTitle")}
        </Link>
        <Link href="/login" className="text-accent underline-offset-4 hover:underline">
          {t("backToLogin")}
        </Link>
      </div>
    </Card>
  );
}
