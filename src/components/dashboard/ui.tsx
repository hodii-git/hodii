import type { ReactNode } from "react";

export const inputCls = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
export const areaCls = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
export const btnPrimary = "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60";
export const btnGhost = "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-input bg-background px-5 text-sm font-bold disabled:opacity-60";

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null | undefined; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return <div className="glass rounded-2xl p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-extrabold tracking-tight">{value}</p>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>;
}

const TONES: Record<string, string> = {
  published: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", pending_review: "bg-amber-500/15 text-amber-600 dark:text-amber-400", draft: "bg-muted text-muted-foreground",
  paused: "bg-muted text-muted-foreground", expired: "bg-orange-500/15 text-orange-600", rejected: "bg-red-500/15 text-red-600", closed: "bg-muted text-muted-foreground",
  new: "bg-primary/15 text-primary", contacted: "bg-sky-500/15 text-sky-600", viewing: "bg-violet-500/15 text-violet-600", won: "bg-emerald-500/15 text-emerald-600", lost: "bg-muted text-muted-foreground", spam: "bg-red-500/15 text-red-600",
  verified: "bg-emerald-500/15 text-emerald-600", unverified: "bg-muted text-muted-foreground", pending: "bg-amber-500/15 text-amber-600",
};
export const label = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const FROZEN_TONE = "bg-sky-500/15 text-sky-700 dark:text-sky-300";
export function Badge({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${TONES[value] ?? (value === "frozen" ? FROZEN_TONE : "bg-muted text-muted-foreground")}`}>{label(value === "pending_review" ? "in review" : value)}</span>;
}

/** Server errors arrive as plain messages; zod errors arrive as JSON. Show the first as is and the second as a generic prompt. */
export const errorText = (e: unknown, fallback = "Something went wrong. Please try again.") => {
  const m = e instanceof Error ? e.message : "";
  return m && !/^[[{]/.test(m) ? m : fallback;
};
