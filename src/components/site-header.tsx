import { HeaderPills } from "@/components/header-search";
import { HeaderSearch } from "@/components/header-search";
import { useEffect, useRef, useState } from "react";
import { installApp, updateApp, usePwa } from "@/lib/pwa";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Download, RefreshCw, Tag, KeyRound, BedDouble, Construction, MapPinned, LandPlot, Landmark, HardHat, DoorOpen, Building, Building2, BedSingle, GraduationCap, ConciergeBell, Briefcase, Store, Warehouse, Tractor, Palmtree, ArrowRight, Calculator, ChevronRight, Home, PlusCircle, Scale, Search, UserRound, Users, X } from "lucide-react";
import { useCompare } from "@/lib/compare";
import { NotificationBell } from "@/components/notification-bell";
import { AccountButton } from "@/components/account-button";
import { HodiiLogo } from "@/components/brand-logo";
import { magnet, unmagnet } from "@/components/wb/ui";
import { useAuth } from "@/hooks/use-auth";
import { moreCategories, primaryCategories } from "@/data/categories";
import { BRAND } from "@/lib/brand";
import { categorySearch } from "@/lib/search-url";
import { isSearchPage, setSheet, toggleSheet, useSheetOpen } from "@/lib/search-sheet";

type NavItem =
  | { label: string; to: "/properties"; search: Record<string, string>; on: (p: string, s: string) => boolean }
  | { label: string; to: "/developments" | "/neighbourhoods"; search?: undefined; on: (p: string, s: string) => boolean };
const NAV: NavItem[] = [
  { label: "For sale", to: "/properties", search: { for: "sale" }, on: (p, s) => p.startsWith("/properties") && s.includes("for=sale") },
  { label: "To rent", to: "/properties", search: { for: "rent" }, on: (p, s) => p.startsWith("/properties") && s.includes("for=rent") },
  { label: "Short stays", to: "/properties", search: { for: "short_stay" }, on: (p, s) => p.startsWith("/properties") && s.includes("for=short_stay") },
  { label: "Developments", to: "/developments", on: (p) => p.startsWith("/development") },
  { label: "Neighbourhoods", to: "/neighbourhoods", on: (p) => p.startsWith("/neighbourhoods") },
];

/** The one site header: a copy of the squared header on the pricing page (same logo, bar, hamburger and menu). */
/** The type pills slide away when you scroll down and slowly return when you scroll up; the page below follows (see --pills-h). */
function PillsRow() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => { const y = window.scrollY; if (y > last + 6 && y > 90) setHidden(true); else if (y < last - 6 || y < 40) setHidden(false); last = y; };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); document.documentElement.style.removeProperty("--pills-h"); };
  }, []);
  useEffect(() => { document.documentElement.style.setProperty("--pills-h", hidden ? "0rem" : "4.5rem"); }, [hidden]);
  return <div className="pills-row" data-hidden={hidden || undefined}><div className="overflow-hidden"><div className="px-3 pb-2 lg:px-6"><HeaderPills /></div></div></div>;
}

export function SiteHeader() {
  const compareCount = useCompare().length;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const signedIn = !!useAuth().user;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pwa = usePwa();
  const navigate = useNavigate();
  const sheet = useSheetOpen();
  /** Phone layout on explore pages: logo and menu sit outside, the bar in the middle is the search. */
  const solid = path === "/properties"; // the explore page: header and type pills form one solid, edge-to-edge block
  const showHeaderSearch = path === "/properties" && !/[?&]view=map/.test(searchStr); // map view carries its own search below the map
  const explore = isSearchPage(path) || path === "/developments" || path === "/neighbourhoods" || path === "/agencies";
  const isPropertyPage = path.startsWith("/property/");
  const openSearch = () => { setOpen(false); if (path === "/properties") toggleSheet(); else { void navigate({ to: "/properties" }); setSheet(true); } };
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    const onToggle = () => setOpen((o) => !o);
    window.addEventListener("hodii:toggle-menu", onToggle);
    return () => window.removeEventListener("hodii:toggle-menu", onToggle);
  }, []);
  useEffect(() => { setOpen(false); }, [path, searchStr]);
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest("[data-menu-trigger]")) return;
      if (e.target instanceof Node && !ref.current?.contains(e.target)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", out);
    window.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", out); window.removeEventListener("keydown", key); };
  }, [open]);
  useEffect(() => {
    if (!open || !isPropertyPage) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, isPropertyPage]);
  const on = scrolled || open;
  const close = () => setOpen(false);
  const row = "menu-link";
  const ICONS: Record<string, typeof Home> = {
    "For sale": Tag, "To rent": KeyRound, "Short stays": BedDouble, "Developments": Construction, "Neighbourhoods": MapPinned,
    "Houses for sale": Home, "Apartments for rent": Building2, "Land for sale": LandPlot, "Commercial property": Landmark, "New developments": HardHat,
    "Houses to rent": DoorOpen, "Apartments for sale": Building, "Bedsitters and studios": BedSingle, "Student housing": GraduationCap, "Serviced apartments": ConciergeBell,
    "Offices": Briefcase, "Shops and retail": Store, "Warehouses": Warehouse, "Farms and ranches": Tractor, "Holiday homes": Palmtree,
  };
  const Tile = (I: typeof Home) => <span className="menu-tile grid size-8 shrink-0 place-items-center rounded-lg"><I className="size-4" aria-hidden /></span>;
  const Chev = <ChevronRight className="h-4 w-4" aria-hidden />;

  return (
    <div className="wb wb-site">
      {!solid && <div aria-hidden="true" className={`nav-blur-zone ${isPropertyPage ? "max-lg:hidden" : ""} ${on ? "is-scrolled" : ""}`} />}
      <div ref={ref} className={solid ? "solid-head glass-nav pointer-events-auto fixed inset-x-0 top-0 z-50" : `pointer-events-none fixed inset-x-0 z-50 mx-auto w-[var(--site-w)] ${isPropertyPage ? "top-12 md:top-4 lg:top-5" : "top-3 sm:top-4 lg:top-5"}`} data-floating>
        {explore && (
          <div className={solid ? "flex items-center gap-2 px-3 py-2 md:hidden" : "pointer-events-auto glass-nav hk-co flex items-center gap-2 !px-2 !py-2 md:hidden"}>
            <button type="button" className="menu-btn relative shrink-0" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
              {<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h18M8 12h13M13 19h8" /></svg>}
              {compareCount > 0 && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />}
            </button>
            <Link to="/" className="logo grid size-10 shrink-0 place-items-center" aria-label={`${BRAND.name} home`}><HodiiLogo /></Link>
            <button type="button" onClick={openSearch} aria-expanded={sheet} aria-label="Search properties" className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-foreground/[0.06] px-3.5 text-left text-sm font-medium text-muted-foreground">
              <Search className="size-4 shrink-0 text-foreground" aria-hidden /><span className="truncate">Search homes, places…</span>
            </button>
          </div>
        )}
        <header data-tour="search" className={`${solid ? "" : "pointer-events-auto glass-nav hk-co"} ${isPropertyPage ? "max-lg:hidden" : explore ? "max-md:hidden" : ""} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2.5 ${solid ? "px-4" : "pl-5 pr-2.5"} lg:grid-cols-[auto_1fr_auto] lg:px-6 ${!solid && on ? "is-scrolled" : ""}`}>
          <Link to="/" className="logo flex min-w-0 items-center gap-2.5 text-foreground" aria-label={`${BRAND.name} home`}>
            <HodiiLogo />
            <span className="truncate font-display text-[1.2rem] font-semibold leading-none">{BRAND.name}</span>
          </Link>
          {showHeaderSearch && <div className="hidden min-w-0 lg:block"><HeaderSearch /></div>}
          <nav aria-label="Main" className={`${showHeaderSearch ? "hidden" : "hidden lg:flex"} items-center justify-center gap-7 text-[0.875rem] font-medium text-foreground/80`}>
            {NAV.map((n) => {
              const cur = n.on(path, searchStr);
              const cls = `nav-link${cur ? " is-current" : ""}`;
              return n.to !== "/properties"
                ? <Link key={n.label} to={n.to} aria-current={cur ? "page" : undefined} className={cls}>{n.label}</Link>
                : <Link key={n.label} to="/properties" search={n.search} aria-current={cur ? "page" : undefined} className={cls}>{n.label}</Link>;
            })}
          </nav>
          <div className="flex items-center justify-end gap-1.5">
            <span className={solid ? "hidden" : "hidden xl:inline-flex"}><Link to="/list-property" data-tour="list" className="btn-dark btn-compact" onMouseMove={magnet} onMouseLeave={unmagnet}>List a property<ArrowRight className="btn-arrow h-4 w-4" /></Link></span>
            {signedIn && <span data-tour="bell" className="inline-flex"><NotificationBell /></span>}
            <span data-tour="account" className="inline-flex"><AccountButton /></span>
            <button type="button" className="menu-btn relative" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
              {open ? <X className="h-5 w-5" /> : <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h18M8 12h13M13 19h8" /></svg>}
              {compareCount > 0 && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />}
            </button>
          </div>
        </header>
        {solid && <PillsRow />}
        {isPropertyPage && <div className="menu-scrim pointer-events-auto" data-open={open} onClick={close} aria-hidden="true" />}
        <div id="site-menu" data-open={open} className="menu-panel site-menu-panel glass-menu pointer-events-auto mt-3 rounded-[1.75rem] px-3 pad-fixed lg:ml-auto lg:w-[34rem]">
          {isPropertyPage && (
            <div>
              <div className="menu-title menu-title-row"><span>Account</span><button type="button" onClick={close} aria-label="Close menu" className="menu-close"><X className="size-5" aria-hidden /></button></div>
              <Link to={signedIn ? "/profile" : "/auth"} className={row} onClick={close}>{Tile(UserRound)}<span className="mr-auto">{signedIn ? "Your profile" : "Sign in or register"}</span>{Chev}</Link>
              {signedIn && <Link to="/notifications" className={row} onClick={close}>{Tile(Bell)}<span className="mr-auto">Notifications</span>{Chev}</Link>}
            </div>
          )}
          {(pwa.standalone || pwa.canInstall) && <button type="button" className={`${row} w-full text-left`} onClick={() => { close(); void (pwa.standalone ? updateApp() : installApp()); }}>{Tile(pwa.standalone ? RefreshCw : Download)}<span className="mr-auto">{pwa.standalone ? "Update app" : "Install app"}</span>{Chev}</button>}
          <div className={isPropertyPage ? "" : "lg:hidden"}>
            <p className="menu-title">Go to</p>
            {NAV.map((n) => n.to !== "/properties"
              ? <Link key={n.label} to={n.to} className={row} onClick={close}>{Tile(ICONS[n.label] ?? Home)}<span className="mr-auto">{n.label}</span>{Chev}</Link>
              : <Link key={n.label} to="/properties" search={n.search} className={row} onClick={close}>{Tile(ICONS[n.label] ?? Home)}<span className="mr-auto">{n.label}</span>{Chev}</Link>)}
          </div>
          <p className="menu-title">Browse by type</p>
          <div className={isPropertyPage ? "grid" : "grid sm:grid-cols-2 sm:gap-x-2"}>
            {[...primaryCategories, ...moreCategories].map((c) => { const k = categorySearch(c); return k ? <Link key={c} to="/properties" search={k.search} className={row} onClick={close}>{Tile(ICONS[c] ?? Home)}<span className="mr-auto">{c}</span>{Chev}</Link> : null; })}
          </div>
          <p className="menu-title">More on {BRAND.name}</p>
          <div className={isPropertyPage ? "grid" : "grid sm:grid-cols-2 sm:gap-x-2"}>
            <Link to="/agencies" className={row} onClick={close}>{Tile(Users)}<span className="mr-auto">Agents and developers</span>{Chev}</Link>
            <Link to="/tools" className={row} onClick={close}>{Tile(Calculator)}<span className="mr-auto">Calculators</span>{Chev}</Link>
            <Link to="/compare" className={row} onClick={close}>{Tile(Scale)}<span className="mr-auto">Compare{compareCount ? ` (${compareCount})` : ""}</span>{Chev}</Link>
            <Link to="/list-property" className={`${row} ${solid ? "" : "xl:hidden"}`} onClick={close}>{Tile(PlusCircle)}<span className="mr-auto">List a property</span>{Chev}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
