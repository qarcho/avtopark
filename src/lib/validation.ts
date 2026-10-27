import { z } from "zod";
import { ROLES } from "@/lib/permissions";

// Every form is validated on the server with these schemas.
// Error messages are translation keys (see messages/*.json → "errors").

const email = z.string().trim().toLowerCase().pipe(z.email("invalid_email").max(200, "invalid_email"));

export const PLATE_RE = /^[A-Z]{2}-[0-9]{3}-[A-Z]{2}$/;

/** Georgian plate: AA-123-BB. Accepts lower case and missing dashes, returns the standard form. */
export const plateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((s) => {
    const compact = s.replace(/[\s-]/g, "");
    return /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(compact)
      ? `${compact.slice(0, 2)}-${compact.slice(2, 5)}-${compact.slice(5)}`
      : s;
  })
  .pipe(z.string().regex(PLATE_RE, "invalid_plate"));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "required").max(200),
});

export const forgotPasswordSchema = z.object({ email });

export const newPasswordSchema = z
  .object({
    password: z.string().min(10, "password_too_short").max(200, "password_too_long"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "passwords_differ", path: ["confirm"] });

export const personName = z.string().trim().min(1, "required").max(120, "too_long");

export const inviteStaffSchema = z.object({
  fullName: personName,
  email,
  role: z.enum(ROLES, "required"),
});

export const changeRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(ROLES),
});

export const removeStaffSchema = z.object({ userId: z.uuid() });

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/, "invalid_slug");

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "required").max(120, "too_long"),
  slug: slugSchema,
  ownerName: personName,
  ownerEmail: email,
});

export const localeSchema = z.enum(["ka", "en"]);

/** Turns a slug-like value out of a company name ("Demo Rent" → "demo-rent"). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** Reads a FormData into a plain object for Zod. */
export function formObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** First error message per field, as translation keys. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
