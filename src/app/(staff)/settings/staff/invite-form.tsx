"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui";
import { initialFormState } from "@/lib/form-state";
import { inviteStaff } from "./actions";

export function InviteForm({ roleOptions }: { roleOptions: { value: string; label: string }[] }) {
  const t = useTranslations();
  const [state, action] = useActionState(inviteStaff, initialFormState);
  return (
    // A successful invite clears the form by remounting it.
    <form key={state.resetKey ?? "form"} action={action} noValidate className="flex flex-col gap-3">
      <FormMessage state={state} />
      <Field label={t("staff.fullName")}name="fullName" error={state.errors?.fullName}>
        <Input name="fullName" autoComplete="off" required defaultValue={state.values?.fullName} error={state.errors?.fullName} />
      </Field>
      <Field label={t("auth.email")}name="email" error={state.errors?.email}>
        <Input name="email" type="email" inputMode="email" autoComplete="off" required defaultValue={state.values?.email} error={state.errors?.email} />
      </Field>
      <Field label={t("staff.role")}name="role" error={state.errors?.role}>
        <Select name="role" defaultValue={state.values?.role || "operator"}>
          {roleOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton>{t("staff.sendInvite")}</SubmitButton>
    </form>
  );
}
