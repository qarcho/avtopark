"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import type { FormState } from "@/lib/form-state";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const BUTTON = {
  primary: "bg-accent text-accent-ink border-accent hover:brightness-110",
  secondary: "bg-surface text-ink border-line hover:border-muted",
  danger: "bg-transparent text-bad border-transparent hover:bg-bad-soft",
  dangerArmed: "bg-bad text-white border-bad",
  ghost: "bg-transparent text-muted border-transparent hover:bg-sunk",
} as const;

export function Button({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BUTTON }) {
  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9",
        BUTTON[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Submit button that shows it is busy while the server action runs. */
export function SubmitButton({ children, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} aria-busy={pending} {...props}>
      {children}
    </Button>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("errors");
  return (
    <div className={cx("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={name} className="text-xs font-bold text-muted">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${name}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-xs font-semibold text-bad" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}

export function Input({ name, error, ...props }: ComponentProps<"input"> & { name: string; error?: string }) {
  return (
    <input
      id={name}
      name={name}
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={error ? `${name}-error` : `${name}-hint`}
      className={cx(
        "min-h-11 w-full rounded-lg border bg-bg px-3 py-2 md:min-h-9",
        error ? "border-bad" : "border-line",
      )}
      {...props}
    />
  );
}

export function Select({ name, children, ...props }: ComponentProps<"select"> & { name: string }) {
  return (
    <select id={name} name={name} className="min-h-11 w-full rounded-lg border border-line bg-bg px-3 py-2 md:min-h-9" {...props}>
      {children}
    </select>
  );
}

/** Success or error message for a whole form. */
export function FormMessage({ state }: { state: FormState }) {
  const t = useTranslations();
  if (!state.message) return null;
  const text = state.message.includes(".") ? t(state.message) : t(`errors.${state.message}`);
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cx(
        "rounded-lg px-3 py-2 text-sm font-semibold",
        state.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad",
      )}
    >
      {text}
    </p>
  );
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("min-w-0 rounded-xl border border-line bg-surface p-4", className)} {...props} />;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-xs font-bold tracking-wider text-muted uppercase">{children}</h2>;
}

export function Pill({ tone = "accent", children }: { tone?: "accent" | "ok" | "warn" | "bad" | "info"; children: ReactNode }) {
  const tones = {
    accent: "bg-accent-soft text-accent",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    info: "bg-info-soft text-info",
  };
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", tones[tone])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
