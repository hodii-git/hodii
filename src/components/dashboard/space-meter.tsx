import type { Usage } from "@/lib/basic-space.server";

/** How much of the free (Basic) listing allowance is used. Paid listings are not counted. */
export function SpaceMeter({ usage }: { usage: Pick<Usage, "used" | "allowance" | "stored" | "storedMax" | "packSlots"> }) {
  const pct = usage.allowance ? Math.min(100, Math.round((usage.used / usage.allowance) * 100)) : 100;
  const full = usage.used >= usage.allowance;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold">Free live listings: {usage.used} of {usage.allowance}{usage.packSlots > 0 && <span className="font-normal text-muted-foreground"> (includes {usage.packSlots} extra)</span>}</p>
        <p className="text-xs text-muted-foreground">Kept in total, including drafts and frozen: {usage.stored} of {usage.storedMax}</p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={usage.allowance} aria-valuenow={usage.used} aria-label="Free live listings used">
        <div className={`h-full rounded-full ${full ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">Boosted and Premium listings are not counted.</p>
    </div>
  );
}
