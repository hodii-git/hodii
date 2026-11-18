import { Link } from "@tanstack/react-router";
import { LayoutGrid, Rocket, Crown, ListChecks } from "lucide-react";
import { btnGhost, btnPrimary } from "./ui";

type Info = { kind: "live" | "stored"; used: number; allowance: number; message: string };

/**
 * Shown when an agency is at its free listing limit. The listing is not lost: it is kept as a draft, and each choice below carries on from there.
 * Boosting or Premium puts it live as soon as it is paid for; space or freeing room lets it go live for free.
 */
export function LimitPanel({ slug, info, listingId, days, onKeep }: { slug: string; info: Info; listingId: string | null; days: number; onKeep: (then: "boost" | "premium" | "space" | "manage") => void }) {
  const card = "flex flex-col gap-2 rounded-2xl border border-border p-4";
  return (
    <div role="alert" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
      <p className="font-extrabold">{info.kind === "live" ? "Your free listings are full" : "Your agency is keeping the most free listings it can"}</p>
      <p className="mt-1 text-sm">{info.message}</p>
      {listingId ? <p className="mt-1 text-xs text-muted-foreground">This listing is saved as a draft, nothing is lost.</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {info.kind === "live" && (
          <>
            <div className={card}><p className="flex items-center gap-2 font-bold"><Rocket className="h-4 w-4" aria-hidden />Boost this listing</p><p className="text-sm text-muted-foreground">Pay for a few days of extra visibility. It goes live as soon as you pay, and does not use a free place.</p><button type="button" onClick={() => onKeep("boost")} className={`${btnPrimary} mt-auto`}>Boost for {days} days</button></div>
            <div className={card}><p className="flex items-center gap-2 font-bold"><Crown className="h-4 w-4" aria-hidden />Premium package</p><p className="text-sm text-muted-foreground">Several listings at once, with a Premium badge and top placement. Add this one when you buy.</p><button type="button" onClick={() => onKeep("premium")} className={`${btnGhost} mt-auto`}>See Premium</button></div>
          </>
        )}
        <div className={card}><p className="flex items-center gap-2 font-bold"><LayoutGrid className="h-4 w-4" aria-hidden />Add listing space</p><p className="text-sm text-muted-foreground">Keep more free listings live without boosting each one.</p><button type="button" onClick={() => onKeep("space")} className={`${btnGhost} mt-auto`}>Add space</button></div>
        <div className={card}><p className="flex items-center gap-2 font-bold"><ListChecks className="h-4 w-4" aria-hidden />Make room yourself</p><p className="text-sm text-muted-foreground">Freeze a listing you are not using, or delete ones you no longer need. Frozen listings are kept and can come back.</p><button type="button" onClick={() => onKeep("manage")} className={`${btnGhost} mt-auto`}>Manage my listings</button></div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground"><Link to="/dashboard/agency/$slug/listings" params={{ slug }} className="underline">Back to all listings</Link></p>
    </div>
  );
}
