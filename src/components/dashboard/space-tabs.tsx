import { Link } from "@tanstack/react-router";
import { Crown, LayoutGrid, Rocket } from "lucide-react";

/** One clear way to move between the ways of getting more room for listings. */
export function SpaceTabs({ slug, active }: { slug: string; active: "space" | "premium" }) {
  const base = "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold shadow-[var(--lift-shadow)]";
  const on = "bg-foreground text-background", off = "bg-card text-foreground hover:bg-[var(--surface)]";
  return (
    <nav aria-label="Get more listing room" className="flex flex-wrap gap-2">
      <Link to="/dashboard/agency/$slug/space" params={{ slug }} className={`${base} ${active === "space" ? on : off}`}><LayoutGrid className="size-4" aria-hidden />Extra space</Link>
      <Link to="/dashboard/agency/$slug/premium" params={{ slug }} className={`${base} ${active === "premium" ? on : off}`}><Crown className="size-4" aria-hidden />Premium packages</Link>
      <Link to="/dashboard/agency/$slug/listings" params={{ slug }} className={`${base} ${off}`}><Rocket className="size-4" aria-hidden />Boost a listing</Link>
    </nav>
  );
}
