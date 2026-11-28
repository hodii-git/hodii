import { HeaderPills, HeaderSearch, MobileTypePills } from "@/components/header-search";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { installApp, updateApp, usePwa } from "@/lib/pwa";
import { FilterBadge, countFilters } from "@/components/ui/filters-icon";
import { paramsFromUrl, type SearchUrl } from "@/lib/search-url";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Download, RefreshCw, Tag, KeyRound, BedDouble, Construction, MapPinned, LandPlot, Landmark, HardHat, DoorOpen, Building, Building2, BedSingle, GraduationCap, ConciergeBell, Briefcase, Store, Warehouse, Tractor, Palmtree, ArrowRight, Calculator, ChevronRight, Home, PlusCircle, Scale, Search, Sparkles, UserRound, Users, X } from "lucide-react";
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
/** The pill look shared with the listing page's top bar. */
const PILL = "ld-pill shrink-0 whitespace-nowrap !h-11 !text-[0.95rem]";

const NAV: NavItem[] = [
  { label: "For sale", to: "/properties", search: { for: "sale" }, on: (p, s) => p.startsWith("/properties") && s.includes("for=sale") },
  { label: "To rent", to: "/properties", search: { for: "rent" }, on: (p, s) => p.startsWith("/properties") && s.includes("for=rent") },
  { label: "Short stays", to: "/properties", search: { for: "short_stay" }, on: (p, s) => p.startsWith("/properties") && s.includes("for=short_stay") },
  { label: "Developments", to: "/developments", on: (p) => p.startsWith("/development") },
  { label: "Neighbourhoods", to: "/neighbourhoods", on: (p) => p.startsWith("/neighbourhoods") },
];

/** The one site header: a copy of the squared header on the pricing page (same logo, bar, hamburger and menu). */
/**
 * The row under the header bar. On large screens it is the big search bar (the type chips live on the content side there);
 * on smaller screens it is the type chips. Both follow the scroll smoothly (see useHeaderScroll): the chips fold away, and the
 * search bar gets lower and slightly narrower while it travels up into the header row, then grows back when you scroll up.
 */
function ExtraRows({ search, phoneRow }: { search: boolean; phoneRow: ReactNode }) {
  return (
    <>
      <div className="md:hidden"><div className="pills-row"><div className="pills-in">{phoneRow}</div></div></div>
      <div className="max-md:hidden lg:hidden"><div className="pills-row"><div className="pills-in"><HeaderPills /></div></div></div>
      {search && <div className="search-dock max-lg:hidden"><div className="search-dock-in"><HeaderSearch /></div></div>}
    </>
  );
}

/**
 * Drives the solid header. --sp (0 to 1) is how far the header has collapsed: it grows as you scroll down and shrinks as you scroll up,
 * eased so it never jumps. --head-h is the real height of the header, so the page below always starts exactly under it.
 */
function useHeaderScroll(el: RefObject<HTMLDivElement | null>, on: boolean) {
  useEffect(() => {
    const node = el.current;
    if (!on || !node) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0, cur = 0, last = window.scrollY, raf = 0;
    const paint = () => { node.style.setProperty("--sp", cur.toFixed(4)); if (cur > 0.6) node.setAttribute("data-collapsed", ""); else node.removeAttribute("data-collapsed"); };
    const loop = () => {
      cur += (target - cur) * (calm ? 1 : 0.14);
      if (Math.abs(target - cur) < 0.002) cur = target;
      paint();
      raf = cur === target ? 0 : requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const onScroll = () => {
      const y = window.scrollY, dy = y - last; last = y;
      target = y < 24 ? 0 : Math.min(1, Math.max(0, target + dy / 240));
      kick();
    };
    const size = () => document.documentElement.style.setProperty("--head-h", `${node.getBoundingClientRect().height}px`);
    const ro = new ResizeObserver(size); ro.observe(node); size();
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); ro.disconnect(); document.documentElement.style.removeProperty("--head-h"); };
  }, [el, on]);
}

export function SiteHeader() {
  const compareCount = useCompare().length;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const rawSearch = useRouterState({ select: (s) => s.location.search }) as SearchUrl;
  const filterN = countFilters(paramsFromUrl(rawSearch));
  const signedIn = !!useAuth().user;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pwa = usePwa();
  const navigate = useNavigate();
  const sheet = useSheetOpen();
  /** Phone layout on explore pages: logo and menu sit outside, the bar in the middle is the search. */
  const solid = path === "/properties" || path === "/"; // the explore page and the homepage: header and type pills form one solid, edge-to-edge block
  const showHeaderSearch = solid && !/[?&]view=map/.test(searchStr); // map view carries its own search below the map
  const explore = isSearchPage(path) || path === "/developments" || path === "/neighbourhoods" || path === "/agencies";
  const isPropertyPage = path.startsWith("/property/");
  const openSearch = () => { setOpen(false); if (path === "/properties" || path === "/") toggleSheet(); else { void navigate({ to: "/properties" }); setSheet(true); } };
  const popup = (which: "filters" | "ai") => window.dispatchEvent(new CustomEvent("hodii:open-popup", { detail: which }));
  /** Second phone row: the filters icon, the search bar, and the round AI button. */
  const phoneRow = (
    <div className="flex items-center gap-2.5">
      <button type="button" aria-label="Filters" aria-haspopup="dialog" onClick={() => popup("filters")} className="ph-filter relative grid size-11 shrink-0 place-items-center rounded-full text-white active:scale-95">
        <svg viewBox="0 0 28 28" className="size-[26px]" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden><path d="M3 8h11M22 8h3M3 20h3M14 20h11" /><circle cx="18" cy="8" r="3.4" /><circle cx="10" cy="20" r="3.4" /></svg>
        <FilterBadge n={filterN} />
      </button>
      <button type="button" onClick={openSearch} aria-expanded={sheet} aria-label="Search properties" className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-foreground/[0.06] px-4 text-left text-[0.95rem] font-medium text-muted-foreground">
        <Search className="size-[1.1rem] shrink-0 text-foreground" aria-hidden /><span className="truncate">Search homes, places…</span>
      </button>
      <button type="button" aria-label="Ask AI" aria-haspopup="dialog" onClick={() => popup("ai")} className="ph-ai grid size-11 shrink-0 place-items-center rounded-full text-white active:scale-95" style={{ background: "var(--brand-gradient)" }}>
        <Sparkles className="size-5" aria-hidden />
      </button>
    </div>
  );
  const ref = useRef<HTMLDivElement>(null);
  useHeaderScroll(ref, solid);
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
      {/* Same full-screen dark overlay as the dashboard side menus; tapping it closes the menu. (Listing pages keep their own, inside the header.) */}
      {!isPropertyPage && <div className="hdr-scrim" data-open={open} onClick={close} aria-hidden="true" />}
      {!solid && <div aria-hidden="true" className={`nav-blur-zone ${isPropertyPage ? "max-lg:hidden" : ""} ${on ? "is-scrolled" : ""}`} />}
      <div ref={ref} className={solid ? "solid-head glass-nav pointer-events-auto fixed inset-x-0 top-0 z-50" : `pointer-events-none fixed inset-x-0 z-50 mx-auto w-[var(--site-w)] ${isPropertyPage ? "top-12 md:top-4 lg:top-5" : "top-3 sm:top-4 lg:top-5"}`} data-floating>
        {explore && solid && (<>
          <div className="ph-r1 md:hidden"><div className="ph-r1-in flex items-center gap-2 pl-3 pr-14">
            <Link to="/" className="logo flex shrink-0 items-center gap-2 pr-1 text-foreground" aria-label={`${BRAND.name} home`}><HodiiLogo outline size="h-9 w-9" /></Link>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 10px, #000 calc(100% - 14px), transparent 100%)", maskImage: "linear-gradient(to right, transparent 0, #000 10px, #000 calc(100% - 14px), transparent 100%)" }} data-tour="type-pills">
              {NAV.map((n) => { const c = `${PILL} ${n.on(path, searchStr) ? "ld-pill-on" : ""}`; return n.to !== "/properties" ? <Link key={n.label} to={n.to} className={c}>{n.label}</Link> : <Link key={n.label} to="/properties" search={n.search} className={c}>{n.label}</Link>; })}
              <span className="h-5 w-px shrink-0 bg-white/20" aria-hidden />
              <MobileTypePills pill={PILL} />
            </div>
          </div></div>
          <button type="button" className="ph-menu md:hidden grid place-items-center text-white active:scale-95" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
              {open ? <X className="size-[26px]" strokeWidth={2.3} /> : <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[26px]" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M4 6.5h16M10 12h10M14 17.5h6" /></svg>}
              {compareCount > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" aria-hidden />}
            </button>
        </>)}
        {explore && !solid && (
          <div className={solid ? "flex items-center gap-2.5 px-3.5 pb-1 pt-3.5 md:hidden" : "pointer-events-auto glass-nav hk-co flex items-center gap-2.5 !px-3 !py-3 md:hidden"}>
            <Link to="/" className="logo grid size-12 shrink-0 place-items-center" aria-label={`${BRAND.name} home`}><HodiiLogo size="h-11 w-11" /></Link>
            <button type="button" onClick={openSearch} aria-expanded={sheet} aria-label="Search properties" className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-foreground/[0.06] px-4 text-left text-[0.95rem] font-medium text-muted-foreground">
              <Search className="size-[1.15rem] shrink-0 text-foreground" aria-hidden /><span className="truncate">Search homes, places…</span>
            </button>
            <button type="button" className="relative grid size-10 shrink-0 place-items-center text-white active:scale-95" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
              {open ? <X className="size-[26px]" strokeWidth={2.3} /> : <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[26px]" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M4 6.5h16M10 12h10M14 17.5h6" /></svg>}
              {compareCount > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-foreground" aria-hidden />}
            </button>
          </div>
        )}
        <header data-tour="search" className={`${solid ? "" : "pointer-events-auto glass-nav hk-co"} ${isPropertyPage ? "max-lg:hidden" : explore ? "max-md:hidden" : ""} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 ${solid ? "px-4 lg:min-h-[var(--hdr-row)]" : "pl-5 pr-2.5"} ${solid ? "lg:grid-cols-[1fr_auto_1fr]" : "lg:grid-cols-[auto_1fr_auto]"} lg:px-6 ${!solid && on ? "is-scrolled" : ""}`}>
          <Link to="/" className="logo flex min-w-0 items-center gap-2.5 text-foreground" aria-label={`${BRAND.name} home`}>
            <HodiiLogo />
            <span className="brand-word truncate font-display text-[1.2rem] font-semibold leading-none">{BRAND.name}</span>
          </Link>
          <nav aria-label="Main" className={`hdr-nav hidden lg:flex items-center justify-center gap-7 text-[0.875rem] font-medium text-foreground/80`}>
            {NAV.map((n) => {
              const cur = n.on(path, searchStr);
              const cls = `nav-link${cur ? " is-current" : ""}`;
              return n.to !== "/properties"
                ? <Link key={n.label} to={n.to} aria-current={cur ? "page" : undefined} className={cls}>{n.label}</Link>
                : <Link key={n.label} to="/properties" search={n.search} aria-current={cur ? "page" : undefined} className={cls}>{n.label}</Link>;
            })}
          </nav>
          <div className="flex items-center justify-end gap-1.5">
            <span className="hidden lg:inline-flex"><Link to="/list-property" data-tour="list" className="btn-dark btn-compact whitespace-nowrap" onMouseMove={magnet} onMouseLeave={unmagnet}>List a property<ArrowRight className="btn-arrow h-4 w-4" /></Link></span>
            {signedIn && <span data-tour="bell" className="inline-flex"><NotificationBell /></span>}
            <span data-tour="account" className="inline-flex"><AccountButton /></span>
            <button type="button" className="menu-btn relative" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
              {open ? <X className="h-5 w-5" /> : <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h18M8 12h13M13 19h8" /></svg>}
              {compareCount > 0 && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />}
            </button>
          </div>
        </header>
        {solid && <ExtraRows search={showHeaderSearch} phoneRow={phoneRow} />}
        {isPropertyPage && <div className="menu-scrim pointer-events-auto" data-open={open} onClick={close} aria-hidden="true" />}
        <div id="site-menu" data-open={open} className="menu-panel site-menu-panel glass-menu pointer-events-auto mt-3 rounded-[1.75rem] lg:ml-auto lg:w-[34rem]"><div className="menu-scroll">
          {(isPropertyPage || explore) && (
            <div className={isPropertyPage ? "" : "md:hidden"}>
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
          <div className="grid">
            {[...primaryCategories, ...moreCategories].map((c) => { const k = categorySearch(c); return k ? <Link key={c} to="/properties" search={k.search} className={row} onClick={close}>{Tile(ICONS[c] ?? Home)}<span className="mr-auto">{c}</span>{Chev}</Link> : null; })}
          </div>
          <p className="menu-title">More on {BRAND.name}</p>
          <div className="grid">
            <Link to="/agencies" className={row} onClick={close}>{Tile(Users)}<span className="mr-auto">Agents and developers</span>{Chev}</Link>
            <Link to="/tools" className={row} onClick={close}>{Tile(Calculator)}<span className="mr-auto">Calculators</span>{Chev}</Link>
            <Link to="/compare" className={`${row} ${compareCount ? "menu-link-active" : ""}`} onClick={close}><span className={`menu-tile ${compareCount ? "menu-tile-on" : ""} relative grid size-8 shrink-0 place-items-center rounded-lg`}><Scale className="size-4" aria-hidden />{compareCount > 0 && <span className="menu-count">{compareCount}</span>}</span><span className="mr-auto">Compare{compareCount ? ` (${compareCount})` : ""}</span>{Chev}</Link>
            <Link to="/list-property" className="menu-cta lg:hidden" onClick={close}><PlusCircle className="size-5" aria-hidden /><span className="mr-auto">List a property</span><ArrowRight className="size-4" aria-hidden /></Link>
          </div>
        </div></div>
      </div>
    </div>
  );
}
