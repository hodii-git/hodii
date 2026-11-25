import { Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarClock, MapPin } from "lucide-react";
import type { DevelopmentCard as Card } from "@/lib/developments.server";

export const STATUS_LABEL: Record<string, string> = { planning: "Planning", off_plan: "Off-plan", under_construction: "Under construction", completed: "Completed" };
export const money = (n: number | null, cur: string) => (n ? `${cur} ${n.toLocaleString("en-KE")}` : null);
export const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-KE", { month: "short", year: "numeric", timeZone: "UTC" }) : null);

export function DevelopmentCard({ d }: { d: Card }) {
  const from = money(d.priceFrom, d.currency), done = when(d.completionDate);
  return (
    <Link to="/development/$slug" params={{ slug: d.slug }} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-background transition hover:shadow-md">
      <span className="relative block aspect-[4/3] overflow-hidden bg-muted">
        {d.image ? <img src={d.image.thumbUrl ?? d.image.url} alt={d.image.alt || d.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" /> : null}
        <span className="absolute left-3 top-3 rounded-full bg-background px-3 py-1 text-xs font-bold shadow">{STATUS_LABEL[d.status] ?? d.status}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <span className="line-clamp-1 text-lg font-extrabold">{d.name}</span>
        <span className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4 shrink-0" aria-hidden /><span className="truncate">{[d.areaName, d.county].filter(Boolean).join(", ")}</span></span>
        <span className="mt-1 font-bold">{from ? `From ${from}` : "Price on request"}</span>
        <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
          {done && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" aria-hidden />{d.status === "completed" ? "Completed" : "Due"} {done}</span>}
          {d.unitTypes > 0 && <span>{d.unitTypes} unit {d.unitTypes === 1 ? "type" : "types"}</span>}
          {d.agency && <span className="inline-flex min-w-0 items-center gap-1"><span className="truncate">{d.agency.name}</span>{d.agency.verified && <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified" />}</span>}
        </span>
      </span>
    </Link>
  );
}
