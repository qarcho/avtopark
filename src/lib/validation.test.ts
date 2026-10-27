import { describe, expect, it } from "vitest";
import {
  createOrganizationSchema,
  fieldErrors,
  inviteStaffSchema,
  loginSchema,
  newPasswordSchema,
  plateSchema,
  slugify,
} from "./validation";

describe("plate numbers", () => {
  it("accepts the Georgian format AA-123-BB", () => {
    expect(plateSchema.parse("TP-416-RA")).toBe("TP-416-RA");
  });

  it("normalises lower case, spaces and missing dashes", () => {
    expect(plateSchema.parse("tp-416-ra")).toBe("TP-416-RA");
    expect(plateSchema.parse("TP416RA")).toBe("TP-416-RA");
    expect(plateSchema.parse(" tp 416 ra ")).toBe("TP-416-RA");
  });

  it("rejects anything else", () => {
    for (const bad of ["T-416-RA", "TP-41-RA", "TP-416-R4", "", "ТР-416-РА"]) {
      expect(plateSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe("login and passwords", () => {
  it("normalises the email", () => {
    expect(loginSchema.parse({ email: "  Giorgi@Example.COM ", password: "x" }).email).toBe("giorgi@example.com");
  });

  it("requires at least 10 characters and matching confirmation", () => {
    expect(newPasswordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
    const r = newPasswordSchema.safeParse({ password: "long-enough-1", confirm: "different-12" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)).toEqual({ confirm: "passwords_differ" });
    expect(newPasswordSchema.safeParse({ password: "long-enough-1", confirm: "long-enough-1" }).success).toBe(true);
  });
});

describe("staff invites and companies", () => {
  it("only allows known roles", () => {
    expect(inviteStaffSchema.safeParse({ fullName: "Nino", email: "nino@example.com", role: "admin" }).success).toBe(false);
    expect(inviteStaffSchema.safeParse({ fullName: "Nino", email: "nino@example.com", role: "operator" }).success).toBe(true);
  });

  it("builds a web address from the company name", () => {
    expect(slugify("Demo Rent")).toBe("demo-rent");
    expect(slugify("  Batumi Cars & Co. ")).toBe("batumi-cars-co");
    expect(slugify("ავტო")).toBe("");
  });

  it("rejects invalid web addresses", () => {
    const base = { name: "X", ownerName: "Owner", ownerEmail: "o@example.com" };
    expect(createOrganizationSchema.safeParse({ ...base, slug: "demo-rent" }).success).toBe(true);
    expect(createOrganizationSchema.safeParse({ ...base, slug: "-demo" }).success).toBe(false);
    expect(createOrganizationSchema.safeParse({ ...base, slug: "demo rent" }).success).toBe(false);
  });
});
