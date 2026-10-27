"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import { initialFormState } from "@/lib/form-state";
import { login } from "../actions";

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(login, initialFormState);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage state={state} />
      <Field label={t("email")} name="email" error={state.errors?.email}>
        <Input name="email" type="email" autoComplete="username" inputMode="email" required defaultValue={state.values?.email} error={state.errors?.email} />
      </Field>
      <Field label={t("password")} name="password" error={state.errors?.password}>
        <Input name="password" type="password" autoComplete="current-password" required error={state.errors?.password} />
      </Field>
      <SubmitButton className="w-full">{t("submitLogin")}</SubmitButton>
      <Link href="/forgot-password" className="text-center text-sm font-semibold text-accent underline-offset-4 hover:underline">
        {t("forgotLink")}
      </Link>
    </form>
  );
}
