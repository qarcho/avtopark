"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button, FormMessage } from "@/components/ui";
import { initialFormState } from "@/lib/form-state";
import { changeRole, removeStaff } from "./actions";

export function MemberActions({
  userId,
  role,
  roleOptions,
}: {
  userId: string;
  role: string;
  roleOptions: { value: string; label: string }[];
}) {
  const t = useTranslations();
  const [roleState, roleAction, rolePending] = useActionState(changeRole, initialFormState);
  const [removeState, removeAction, removePending] = useActionState(removeStaff, initialFormState);
  const [armed, setArmed] = useState(false);
  const error = !roleState.ok && roleState.message ? roleState : !removeState.ok && removeState.message ? removeState : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={roleAction}>
        <input type="hidden" name="userId" value={userId} />
        <select
          name="role"
          aria-label={t("staff.role")}
          defaultValue={role}
          disabled={rolePending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="min-h-11 rounded-lg border border-line bg-bg px-2 text-sm font-semibold md:min-h-9"
        >
          {roleOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </form>
      <form action={removeAction}>
        <input type="hidden" name="userId" value={userId} />
        <Button
          type={armed ? "submit" : "button"}
          variant={armed ? "dangerArmed" : "danger"}
          disabled={removePending}
          onClick={() => !armed && setArmed(true)}
          onBlur={() => setArmed(false)}
        >
          {armed ? t("common.confirmRemove") : t("common.remove")}
        </Button>
      </form>
      {error && (
        <div className="w-full">
          <FormMessage state={error} />
        </div>
      )}
    </div>
  );
}
