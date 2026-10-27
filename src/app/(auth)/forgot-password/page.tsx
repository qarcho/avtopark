import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("forgotTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <Card className="p-6">
      <h1 className="text-2xl font-extrabold tracking-tight">{t("forgotTitle")}</h1>
      <p className="mt-1 mb-5 text-sm text-muted">{t("forgotSub")}</p>
      <ForgotForm />
    </Card>
  );
}
