/** What a server action returns to its form. Messages are translation keys. */
export type FormState = {
  ok?: boolean;
  /** Key under "errors" (when ok is false) or a full key like "staff.invited" (when ok is true). */
  message?: string;
  /** Field name → key under "errors". */
  errors?: Record<string, string>;
  /** Echo of submitted values (never passwords) so the form keeps them after an error. */
  values?: Record<string, string>;
  /** New on every success, so forms can reset themselves (used as a React key). */
  resetKey?: string;
};

export function success(message: string): FormState {
  return { ok: true, message, resetKey: crypto.randomUUID() };
}

export const initialFormState: FormState = {};
