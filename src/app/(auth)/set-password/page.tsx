import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { SetPasswordForm } from "./set-password-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("setPasswordTitle") };
}

// Reached from an invite (/auth/accept) or password-reset email (/auth/confirm), once the link has logged the person in.
export default async function SetPasswordPage() {
  if (!(await getUser())) redirect("/login");
  const t = await getTranslations("auth");
  return (
    <Card className="p-6">
      <h1 className="text-2xl font-extrabold tracking-tight">{t("setPasswordTitle")}</h1>
      <p className="mt-1 mb-5 text-sm text-muted">{t("setPasswordSub")}</p>
      <SetPasswordForm />
    </Card>
  );
}
