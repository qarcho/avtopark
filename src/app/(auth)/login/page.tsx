import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("loginTitle") };
}

export default async function LoginPage() {
  if (await getUser()) redirect("/today");
  const t = await getTranslations("auth");
  return (
    <Card className="p-6">
      <h1 className="text-2xl font-extrabold tracking-tight">{t("loginTitle")}</h1>
      <p className="mt-1 mb-5 text-sm text-muted">{t("loginSub")}</p>
      <LoginForm />
    </Card>
  );
}
