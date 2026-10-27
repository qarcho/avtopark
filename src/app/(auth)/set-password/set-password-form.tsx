"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import { initialFormState } from "@/lib/form-state";
import { setPassword } from "../actions";

export function SetPasswordForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(setPassword, initialFormState);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormMessage state={state} />
      <Field label={t("newPassword")} name="password" error={state.errors?.password} hint={t("passwordHint")}>
        <Input name="password" type="password" autoComplete="new-password" minLength={10} required error={state.errors?.password} />
      </Field>
      <Field label={t("confirmPassword")} name="confirm" error={state.errors?.confirm}>
        <Input name="confirm" type="password" autoComplete="new-password" required error={state.errors?.confirm} />
      </Field>
      <SubmitButton className="w-full">{t("savePassword")}</SubmitButton>
    </form>
  );
}
