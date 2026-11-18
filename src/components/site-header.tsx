import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronDown, Menu, Search, X } from "lucide-react";
import { useCompare } from "@/lib/compare";
import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/notification-bell";
import { AccountButton } from "@/components/account-button";
import { HodiiLogo } from "@/components/brand-logo";
import { ThemeHeaderButton } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { moreCategories, primaryCategories } from "@/data/categories";
import { BRAND } from "@/lib/brand";
import { categorySearch } from "@/lib/search-url";

const linkCls = "rounded-full px-3 py-2 text-sm font-semibold text-foreground/80 whitespace-nowrap transition hover:bg-navigation-highlight hover:text-foreground";

/** A navigation category opens the property search it stands for. */
function CategoryLink({ name, className = linkCls, onClick }: { name: string; className?: string; onClick?: () => void }) {
  const c = categorySearch(name);
  return c ? <Link to="/properties" search={c.search} className={className} onClick={onClick} activeOptions={{ exact: true }}>{name}</Link> : null;
}

/** One header for every page: logo, categories, search, List a property, theme and account. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const compareCount = useCompare().length;
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[112rem] items-center gap-2 px-4">
        <Link to="/" className="mr-2 flex shrink-0 items-center gap-2 font-extrabold tracking-tight" aria-label={`${BRAND.name} home`} onClick={() => setOpen(false)}>
          <HodiiLogo /><span className="text-xl">{BRAND.name}</span>
        </Link>

        <nav aria-label="Property categories" className="hidden flex-1 items-center gap-0.5 2xl:flex">
          {primaryCategories.map((c) => <CategoryLink key={c} name={c} />)}
          <DropdownMenu>
            <DropdownMenuTrigger className={`${linkCls} inline-flex items-center gap-1 outline-hidden focus-visible:ring-2 focus-visible:ring-ring`}>More<ChevronDown className="h-4 w-4" aria-hidden /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-strong grid w-80 max-w-[calc(100vw-2rem)] grid-cols-2 gap-1 rounded-2xl p-2">
              {moreCategories.map((c) => <DropdownMenuItem key={c} asChild className="rounded-xl px-3 py-2 font-medium"><CategoryLink name={c} className="w-full" /></DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link to="/agencies" className={linkCls}>Agents</Link>
          <Link to="/tools" className={linkCls}>Calculators</Link>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="rounded-full"><Link to="/properties" aria-label="Search properties" data-tour="search"><Search className="h-5 w-5" /></Link></Button>
          <Button asChild variant="ghost" size="icon" className="relative hidden rounded-full sm:inline-flex"><Link to="/compare" aria-label={compareCount ? `Compare ${compareCount} properties` : "Compare properties"} title="Compare"><ArrowLeftRight className="h-5 w-5" />{compareCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-extrabold leading-4 text-primary-foreground">{compareCount}</span>}</Link></Button>
          <Button asChild className="hidden rounded-full font-bold sm:inline-flex"><Link to="/list-property" data-tour="list">List a property</Link></Button>
          <ThemeHeaderButton />
          <span data-tour="bell" className="inline-flex"><NotificationBell /></span>
          <span data-tour="account" className="inline-flex"><AccountButton /></span>
          <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-navigation-highlight 2xl:hidden">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Property categories" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-background px-4 pb-6 pt-3 2xl:hidden">
          <ul className="grid gap-1 sm:grid-cols-2">
            {[...primaryCategories, ...moreCategories].map((c) => <li key={c}><CategoryLink name={c} className="block rounded-xl px-3 py-3 font-semibold hover:bg-navigation-highlight" onClick={() => setOpen(false)} /></li>)}
          </ul>
          <Link to="/compare" onClick={() => setOpen(false)} className="mt-2 block rounded-xl px-3 py-3 font-semibold hover:bg-navigation-highlight">Compare{compareCount ? ` (${compareCount})` : ""}</Link>
          <Link to="/tools" onClick={() => setOpen(false)} className="mt-2 block rounded-xl px-3 py-3 font-semibold hover:bg-navigation-highlight">Calculators</Link>
          <Link to="/agencies" onClick={() => setOpen(false)} className="mt-2 block rounded-xl px-3 py-3 font-semibold hover:bg-navigation-highlight">Agents and developers</Link>
          <Button asChild className="mt-4 h-12 w-full rounded-full text-base font-bold"><Link to="/list-property" onClick={() => setOpen(false)}>List a property</Link></Button>
        </nav>
      )}
    </header>
  );
}
