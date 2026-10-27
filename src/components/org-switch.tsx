"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchOrganization } from "@/app/actions";
import type { Membership } from "@/lib/auth";

/** Shows the current company; lets people who work for several companies switch. */
export function OrgSwitch({ memberships, currentId, label }: { memberships: Membership[]; currentId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const current = memberships.find((m) => m.organizationId === currentId);

  if (memberships.length < 2) {
    return <small className="block truncate text-xs text-muted">{current?.organizationName}</small>;
  }
  return (
    <select
      aria-label={label}
      value={currentId}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          await switchOrganization(e.target.value);
          router.refresh();
        })
      }
      className="max-w-48 truncate rounded border-0 bg-transparent p-0 text-xs! text-muted"
    >
      {memberships.map((m) => (
        <option key={m.organizationId} value={m.organizationId}>
          {m.organizationName}
        </option>
      ))}
    </select>
  );
}
