// What each staff role may do. The database enforces the same rules (see the
// foundation migration); these checks decide what the UI offers and guard server actions.

export const ROLES = ["owner", "manager", "operator"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "view_revenue"
  | "edit_prices"
  | "edit_settings"
  | "delete_records"
  | "manage_blacklist"
  | "manage_staff"
  | "manage_owners";

const MANAGER_PERMISSIONS: readonly Permission[] = [
  "view_revenue",
  "edit_prices",
  "edit_settings",
  "delete_records",
  "manage_blacklist",
  "manage_staff",
];

export function isManagerRole(role: Role): boolean {
  return role === "owner" || role === "manager";
}

export function can(role: Role, permission: Permission): boolean {
  if (permission === "manage_owners") return role === "owner";
  return isManagerRole(role) && MANAGER_PERMISSIONS.includes(permission);
}

/** Which roles this person may give to someone else. */
export function assignableRoles(role: Role): Role[] {
  if (role === "owner") return ["owner", "manager", "operator"];
  if (role === "manager") return ["manager", "operator"];
  return [];
}

/** Whether `actor` may change or remove a colleague who currently has `target` role. */
export function canManageMember(actor: Role, target: Role): boolean {
  if (!can(actor, "manage_staff")) return false;
  return target !== "owner" || actor === "owner";
}
