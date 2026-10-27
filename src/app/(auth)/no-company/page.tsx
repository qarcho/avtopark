import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { Button, Card } from "@/components/ui";
import { getMemberships, getUser } from "@/lib/auth";

export default async function NoCompanyPage() {
  if (!(await getUser())) redirect("/login");
  if ((await getMemberships()).length > 0) redirect("/today");
  const t = await getTranslations();
  return (
    <Card className="p-6">
      <h1 className="text-2xl font-extrabold tracking-tight">{t("auth.noCompanyTitle")}</h1>
      <p className="mt-2 mb-5 text-sm text-muted">{t("auth.noCompany")}</p>
      <form action={signOut}>
        <Button type="submit" className="w-full">
          {t("nav.signOut")}
        </Button>
      </form>
    </Card>
  );
}
