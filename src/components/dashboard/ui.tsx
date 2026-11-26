import type { ReactNode } from "react";
import { AttentionSlot } from "@/components/dashboard/attention";

export const inputCls = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
export const areaCls = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
export const btnPrimary = "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-60";
export const btnGhost = "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-input bg-background px-5 text-sm font-bold disabled:opacity-60";

/** The title block every dashboard page starts with: one colour (the theme text colour) on the plain page background, the same on every page. */
export function PageTitle({ title, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0"><h1 className="text-2xl font-extrabold text-foreground md:text-3xl">{title}</h1></div>
      {right && <div className="flex shrink-0 flex-wrap gap-2">{right}</div>}
    </header>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <>
      <PageTitle title={title} sub={sub} right={right} />
      <AttentionSlot />
    </>
  );
}

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
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-extrabold">{value}</p>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>;
}

const TONES: Record<string, string> = {
  published: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", pending_review: "bg-amber-500/15 text-amber-600 dark:text-amber-400", draft: "bg-muted text-muted-foreground",
  paused: "bg-muted text-muted-foreground", expired: "bg-orange-500/15 text-orange-600", rejected: "bg-red-500/15 text-red-600", closed: "bg-muted text-muted-foreground",
  new: "bg-foreground/15 text-primary", contacted: "bg-sky-500/15 text-sky-600", viewing: "bg-violet-500/15 text-violet-600", won: "bg-emerald-500/15 text-emerald-600", lost: "bg-muted text-muted-foreground", spam: "bg-red-500/15 text-red-600",
  verified: "bg-emerald-500/15 text-emerald-600", unverified: "bg-muted text-muted-foreground", pending: "bg-amber-500/15 text-amber-600",
};
export const label = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const FROZEN_TONE = "bg-sky-500/15 text-sky-700 dark:text-sky-300";
export function Badge({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${TONES[value] ?? (value === "frozen" ? FROZEN_TONE : "bg-muted text-muted-foreground")}`}>{label(value === "pending_review" ? "in review" : value)}</span>;
}

/** Server errors arrive as plain messages; zod errors arrive as JSON. Show the first as is and the second as a generic prompt. */
const fieldName = (path: unknown) => {
  const parts = (Array.isArray(path) ? path : String(path ?? "").split(".")).filter((x) => typeof x === "string" && x !== "form" && x !== "data") as string[];
  const s = parts.join(" ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
};
/** Says exactly what was wrong: a server check that names the field ("Price amount: Expected number") is shown as it is, never swapped for a vague fallback. */
export const errorText = (e: unknown, fallback = "Something went wrong. Please try again.") => {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (m && !/^[[{]/.test(m)) return m;
  try {
    const j = JSON.parse(m) as unknown;
    const list = Array.isArray(j) ? j : (j as { issues?: unknown[] })?.issues;
    if (Array.isArray(list) && list.length) {
      const msgs = (list as { path?: unknown; message?: string }[]).slice(0, 3).map((i) => { const f = fieldName(i.path); return f ? `${f}: ${i.message ?? "is not valid"}` : (i.message ?? ""); }).filter(Boolean);
      if (msgs.length) return msgs.join(" · ") + (list.length > 3 ? ` (and ${list.length - 3} more)` : "");
    }
  } catch { /* not JSON */ }
  return fallback;
};
