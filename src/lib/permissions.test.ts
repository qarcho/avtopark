import { describe, expect, it } from "vitest";
import { assignableRoles, can, canManageMember } from "./permissions";

describe("permissions", () => {
  it("operators cannot see revenue, change prices or settings, or delete", () => {
    for (const p of ["view_revenue", "edit_prices", "edit_settings", "delete_records", "manage_blacklist", "manage_staff"] as const) {
      expect(can("operator", p)).toBe(false);
    }
  });

  it("owners and managers can do everything except managing owners", () => {
    for (const p of ["view_revenue", "edit_prices", "edit_settings", "delete_records", "manage_blacklist", "manage_staff"] as const) {
      expect(can("owner", p)).toBe(true);
      expect(can("manager", p)).toBe(true);
    }
    expect(can("manager", "manage_owners")).toBe(false);
    expect(can("owner", "manage_owners")).toBe(true);
  });

  it("only owners can create or touch other owners", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("manager")).toEqual(["manager", "operator"]);
    expect(assignableRoles("operator")).toEqual([]);
    expect(canManageMember("manager", "owner")).toBe(false);
    expect(canManageMember("manager", "operator")).toBe(true);
    expect(canManageMember("owner", "owner")).toBe(true);
    expect(canManageMember("operator", "operator")).toBe(false);
  });
});
