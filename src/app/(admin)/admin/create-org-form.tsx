"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui";
import { initialFormState, type FormState } from "@/lib/form-state";
import { slugify } from "@/lib/validation";
import { createOrganization } from "./actions";

export function CreateOrgForm() {
  const [state, action] = useActionState(createOrganization, initialFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-3">
      <FormMessage state={state} />
      {/* After a success the fields remount empty. */}
      <Fields key={state.resetKey ?? "form"} state={state.ok ? {} : state} />
    </form>
  );
}

function Fields({ state }: { state: FormState }) {
  const t = useTranslations("admin");
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(state.values?.slug));

  return (
    <>
      <Field label={t("name")} name="name" error={state.errors?.name}>
        <Input
          name="name"
          autoComplete="organization"
          required
          defaultValue={state.values?.name}
          error={state.errors?.name}
          onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
        />
      </Field>
      <Field label={t("slug")} name="slug" error={state.errors?.slug} hint={t("slugHelp", { slug: slug || "demo-rent" })}>
        <Input
          name="slug"
          autoComplete="off"
          autoCapitalize="none"
          required
          value={slug}
          error={state.errors?.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
        />
      </Field>
      <Field label={t("ownerName")} name="ownerName" error={state.errors?.ownerName}>
        <Input name="ownerName" autoComplete="off" required defaultValue={state.values?.ownerName} error={state.errors?.ownerName} />
      </Field>
      <Field label={t("ownerEmail")} name="ownerEmail" error={state.errors?.ownerEmail}>
        <Input name="ownerEmail" type="email" inputMode="email" autoComplete="off" required defaultValue={state.values?.ownerEmail} error={state.errors?.ownerEmail} />
      </Field>
      <SubmitButton>{t("submit")}</SubmitButton>
    </>
  );
}
