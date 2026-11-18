import { Rocket, Crown } from "lucide-react";

/** Shown on a listing's photo. Basic listings have no badge, so a badge always means someone paid and the site says so. */
export function TierBadge({ tier }: { tier: "boost" | "premium" }) {
  return tier === "premium"
    ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-black"><Crown className="h-3 w-3" aria-hidden />Premium</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground"><Rocket className="h-3 w-3" aria-hidden />Boosted</span>;
}
