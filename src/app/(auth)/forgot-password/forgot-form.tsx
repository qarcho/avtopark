"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import { initialFormState } from "@/lib/form-state";
import { requestPasswordReset } from "../actions";

export function ForgotForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(requestPasswordReset, initialFormState);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage state={state} />
      {!state.ok && (
        <>
          <Field label={t("email")} name="email" error={state.errors?.email}>
            <Input name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} error={state.errors?.email} />
          </Field>
          <SubmitButton className="w-full">{t("sendLink")}</SubmitButton>
        </>
      )}
      <Link href="/login" className="text-center text-sm font-semibold text-accent underline-offset-4 hover:underline">
        {t("backToLogin")}
      </Link>
    </form>
  );
}
