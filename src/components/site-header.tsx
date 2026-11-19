import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Search } from "lucide-react";
import { useCompare } from "@/lib/compare";
import { NotificationBell } from "@/components/notification-bell";
import { AccountButton } from "@/components/account-button";
import { HodiiLogo } from "@/components/brand-logo";
import { ThemeHeaderButton } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { moreCategories, primaryCategories } from "@/data/categories";
import { BRAND } from "@/lib/brand";
import { categorySearch } from "@/lib/search-url";


/** A navigation category opens the property search it stands for. */
function CategoryLink({ name, className = "", onClick }: { name: string; className?: string; onClick?: () => void }) {
  const c = categorySearch(name);
  return c ? <Link to="/properties" search={c.search} className={className} onClick={onClick} activeOptions={{ exact: true }}>{name}</Link> : null;
}

type Kind = "browse" | "search" | "content" | "app";
/** What each kind of page needs from the header. Listing pages that already have a search on them skip the header search; guides and info pages get reading links; signed-in work areas get a quiet bar with a place label. */
function kindOf(path: string): { kind: Kind; label?: string } {
  if (path.startsWith("/dashboard")) return { kind: "app", label: "Dashboard" };
  if (path.startsWith("/profile")) return { kind: "app", label: "My account" };
  if (path.startsWith("/saved")) return { kind: "app", label: "Saved" };
  if (path.startsWith("/notifications")) return { kind: "app", label: "Notifications" };
  if (path.startsWith("/admin")) return { kind: "app", label: "Admin" };
  if (/^\/(info|help|tools|feedback)/.test(path)) return { kind: "content" };
  if (path === "/" || path === "/properties") return { kind: "browse" };
  return { kind: "search" };
}
const READING = [{ to: "/info/$slug", slug: "buying-guide", label: "Buying guide" }, { to: "/info/$slug", slug: "renting-guide", label: "Renting guide" }, { to: "/tools", label: "Calculators" }, { to: "/help", label: "Help" }] as const;

/** One header, in four quiet styles chosen by page. */
export function SiteHeader() {
  const compareCount = useCompare().length;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { kind, label } = kindOf(path);
  const item = "rounded-xl px-3 py-2 font-medium";
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-[82rem] items-center gap-3 px-4 md:px-6 xl:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight text-primary" aria-label={`${BRAND.name} home`}>
          <HodiiLogo /><span className="hidden text-xl sm:inline">{BRAND.name}</span>
        </Link>
        {kind === "app" && label && <span className="ml-1 hidden items-center gap-3 sm:flex"><span className="h-5 w-px bg-border" aria-hidden /><span className="text-sm font-bold">{label}</span></span>}

        {kind === "search" && (
          <Link to="/properties" data-tour="search" aria-label="Search properties" className="mx-auto hidden h-11 w-full max-w-md items-center gap-3 rounded-full border border-border bg-background pl-5 pr-2 text-sm shadow-sm transition hover:shadow-md md:flex">
            <span className="font-semibold">Anywhere in Kenya</span>
            <span className="h-5 w-px bg-border" aria-hidden />
            <span className="flex-1 truncate text-left text-muted-foreground">Area, estate or type</span>
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"><Search className="size-4" aria-hidden /></span>
          </Link>
        )}
        {kind === "content" && (
          <nav aria-label="Reading" className="mx-auto hidden items-center gap-1 md:flex">
            {READING.map((r) => "slug" in r
              ? <Link key={r.label} to={r.to} params={{ slug: r.slug }} className="rounded-full px-3 py-2 text-sm font-semibold text-foreground/80 hover:bg-navigation-highlight hover:text-foreground">{r.label}</Link>
              : <Link key={r.label} to={r.to} className="rounded-full px-3 py-2 text-sm font-semibold text-foreground/80 hover:bg-navigation-highlight hover:text-foreground">{r.label}</Link>)}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          {kind === "search" && <Button asChild variant="ghost" size="icon" className="rounded-full md:hidden"><Link to="/properties" aria-label="Search properties"><Search className="h-5 w-5" /></Link></Button>}
          {kind !== "app" && <Button asChild variant="ghost" className="hidden rounded-full text-sm font-semibold lg:inline-flex"><Link to="/list-property" data-tour="list">List a property</Link></Button>}
          {kind !== "app" && (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Browse" className="relative grid h-10 w-10 place-items-center rounded-full outline-hidden hover:bg-navigation-highlight focus-visible:ring-2 focus-visible:ring-ring">
              <Menu className="h-5 w-5" aria-hidden />
              {compareCount > 0 && <span className="dot-pulse absolute right-1 top-1 size-2.5 rounded-full bg-primary" aria-hidden />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[min(80dvh,34rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-border bg-popover p-2 shadow-xl">
              <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Browse</p>
              {[...primaryCategories, ...moreCategories].map((c) => <DropdownMenuItem key={c} asChild className={item}><CategoryLink name={c} className="w-full" /></DropdownMenuItem>)}
              <div className="my-2 h-px bg-border" />
              <DropdownMenuItem asChild className={item}><Link to="/agencies" className="w-full">Agents and developers</Link></DropdownMenuItem>
              <DropdownMenuItem asChild className={item}><Link to="/tools" className="w-full">Calculators</Link></DropdownMenuItem>
              <DropdownMenuItem asChild className={item}><Link to="/compare" className="w-full">Compare{compareCount ? ` (${compareCount})` : ""}{compareCount > 0 && <span className="dot-pulse ml-2 inline-block size-2.5 rounded-full bg-primary" aria-hidden />}</Link></DropdownMenuItem>
              <DropdownMenuItem asChild className={`${item} lg:hidden`}><Link to="/list-property" className="w-full font-bold text-primary">List a property</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>)}
          {kind === "app" && <Button asChild variant="ghost" className="hidden rounded-full text-sm font-semibold sm:inline-flex"><Link to="/properties">Browse listings</Link></Button>}
          <ThemeHeaderButton />
          <span data-tour="bell" className="inline-flex"><NotificationBell /></span>
          <span data-tour="account" className="inline-flex"><AccountButton /></span>
        </div>
      </div>
    </header>
  );
}
