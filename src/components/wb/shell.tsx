import "@/webbora.css";
import { primaryCategories, moreCategories } from "@/data/categories";
import "@/webbora-extra.css";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUp, ChevronRight, Search, X } from "lucide-react";
import { footerSections, slugify, type FooterColumn } from "@/data/site-content";
import { categorySearch } from "@/lib/search-url";
import { BRAND } from "@/lib/brand";
import { Bold, DarkBtn, WLink, magnet, unmagnet, useReveal } from "@/components/wb/ui";
import { COMPANY_SPLIT, headerFor, type HeaderCfg } from "@/components/wb/header-config";

const LogoMark = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className="logo-mark h-8 w-8 shrink-0">
    <rect width="32" height="32" rx="9" className="fill-foreground" />
    <path d="M7 15.5 16 8l9 7.5V24a1 1 0 0 1-1 1h-5v-6h-6v6H8a1 1 0 0 1-1-1z" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-card" />
  </svg>
);
const Logo = () => (
  <Link to="/" className="logo flex min-w-0 items-center gap-2.5 text-foreground" aria-label={`${BRAND.name} home`}>
    <LogoMark />
    <span className="truncate font-display text-[1.2rem] font-semibold leading-none">{BRAND.name}</span>
  </Link>
);

const MenuIcon = ({ open }: { open: boolean }) => open ? <X className="h-5 w-5" /> : (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 5h18M8 12h13M13 19h8" /></svg>
);

/** Three different header designs: one for guides, one for company pages and one for support and legal pages. */
export function WbHeader({ cfg, slug }: { cfg: HeaderCfg; slug: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setOpen(false); }, [slug]);
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { if (e.target instanceof Node && !ref.current?.contains(e.target)) setOpen(false); };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", out);
    window.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", out); window.removeEventListener("keydown", key); };
  }, [open]);

  const cur = `/info/${slug}`;
  const link = (n: { l: string; to: string }, cls = "nav-link") => (
    <WLink key={n.l} to={n.to} className={`${cls}${n.to === cur ? " is-current" : ""}`}><Bold t={n.l} /></WLink>
  );
  const menuBtn = (
    <button type="button" className="menu-btn lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="wb-mobile-menu" onClick={() => setOpen((o) => !o)}><MenuIcon open={open} /></button>
  );
  const on = scrolled || open;

  return (
    <>
      <div aria-hidden="true" className={`nav-blur-zone ${on ? "is-scrolled" : ""}`} />
      <div ref={ref} className="pointer-events-none fixed inset-x-0 top-3 z-50 mx-auto w-[var(--site-w)] sm:top-4 lg:top-5" data-hk={cfg.kind}>
        <header className={`pointer-events-auto glass-nav fade-down hk-co grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2.5 pl-5 pr-2.5 lg:grid-cols-[auto_1fr_auto] lg:px-6 ${on ? "is-scrolled" : ""}`}>
          <Logo />
          {cfg.kind === "support" ? (
            <form className="hk-search mx-auto hidden w-full max-w-md lg:flex" role="search" onSubmit={(e) => { e.preventDefault(); void nav({ to: "/info/$slug", params: { slug: "help-centre" }, ...(q ? { hash: `q=${encodeURIComponent(q)}` } : {}) }); }}>
              <Search className="h-4 w-4 opacity-60" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the help centre" aria-label="Search the help centre" />
            </form>
          ) : (
            <nav className="hidden items-center justify-center gap-4 text-[0.85rem] xl:gap-7 xl:text-[0.875rem] font-medium text-foreground/80 lg:flex" aria-label="Section">{cfg.nav.map((n) => link(n))}</nav>
          )}
          <div className="flex items-center justify-end gap-1">
            <DarkBtn to={cfg.cta.to} compact>{cfg.cta.l}</DarkBtn>
            {menuBtn}
          </div>
        </header>
        <div id="wb-mobile-menu" data-open={open} className="menu-panel mt-3 rounded-[1.75rem] p-3 lg:hidden">
          <nav className="flex flex-col">
            {[...cfg.nav, ...(cfg.secondary ? [cfg.secondary] : [])].map((n) => (
              <WLink key={n.l} to={n.to} className="menu-link" onClick={() => setOpen(false)}>{n.l}<ChevronRight className="h-4 w-4" /></WLink>
            ))}
            <WLink to="/properties" className="menu-link" onClick={() => setOpen(false)}>Browse properties<ChevronRight className="h-4 w-4" /></WLink>
          </nav>
        </div>
      </div>
    </>
  );
}

function FooterLink({ label, kind }: { label: string; kind: FooterColumn["kind"] }) {
  if (label === "New developments") return <Link to="/developments" className="foot-link"><Bold t={label} /></Link>;
  if (label === "Neighbourhoods") return <Link to="/neighbourhoods" className="foot-link"><Bold t={label} /></Link>;
  const c = kind === "section" ? categorySearch(label) : null;
  return c ? (
    <Link to="/properties" search={c.search} className="foot-link"><Bold t={label} /></Link>
  ) : (
    <Link to="/info/$slug" params={{ slug: slugify(label) }} className="foot-link"><Bold t={label} /></Link>
  );
}

/** Webbora's footer, with Hodii's links. Used on every public page. */
export function WbFooter() {
  const path = useRouterState({ select: (st) => st.location.pathname });
  useReveal(`footer-${path}`);
  return (
    <div className="wb wb-footer">
      <footer className="mx-auto w-[var(--site-w)] max-w-full pb-6 pt-16">
        <div className="footer-card relative overflow-hidden rounded-[2rem] px-6 pt-12 sm:px-10 lg:px-14 lg:pt-16">
          <div className="footer-ribs pointer-events-none absolute inset-0" />
          <div className="relative grid gap-12 lg:grid-cols-[1.1fr_2.2fr]">
            <div>
              <span className="chip-dark"><span className="status-dot" />Verified agents online</span>
              <h2 className="mt-6 font-display text-[clamp(1.9rem,3.6vw,3rem)] font-semibold leading-tight">Ready to find<br />your place?</h2>
              <p className="footer-muted mt-4 max-w-sm">{BRAND.tagline}. Homes, land and commercial space for sale and to rent, from verified agencies and owners.</p>
              <p className="footer-muted mt-3 text-[0.9rem]">Or email <a href={`mailto:${BRAND.emails.general}`} className="foot-link inline"><Bold t={BRAND.emails.general} /></a></p>
              <Link to="/list-property" className="btn-dark mt-8" onMouseMove={magnet} onMouseLeave={unmagnet}>List a property<ArrowRight className="btn-arrow h-4 w-4" /></Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3 2xl:grid-cols-5">
              {footerSections.map((col) => col.heading === "Properties" ? { ...col, links: [...new Set([...col.links, ...primaryCategories, ...moreCategories])] } : col).map((col) => (
                <div key={col.heading} className="footer-panel rounded-2xl p-5">
                  <h3 className="footer-muted text-[0.8rem] font-medium uppercase">{col.heading}</h3>
                  <ul className="mt-4 space-y-1.5 text-[0.95rem]">
                    {col.links.map((l) => (<li key={l}><FooterLink label={l} kind={col.kind} /></li>))}
                  </ul>
                </div>
              ))}
              <div className="footer-panel rounded-2xl p-5">
                <h3 className="footer-muted text-[0.8rem] font-medium uppercase">Explore {BRAND.name}</h3>
                <ul className="mt-4 space-y-1.5 text-[0.95rem]">
                  <li><Link to="/agencies" className="foot-link"><Bold t="Agents and developers" /></Link></li>
                  <li><Link to="/tools" className="foot-link"><Bold t="Calculators" /></Link></li>
                  <li><Link to="/compare" className="foot-link"><Bold t="Compare" /></Link></li>
                  <li><Link to="/list-property" className="foot-link"><Bold t="List a property" /></Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="relative mt-14 flex flex-wrap items-center justify-between gap-4 text-[0.85rem]">
            <span className="footer-muted">© {new Date().getFullYear()} {BRAND.legalName}. All rights reserved.</span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {["Privacy", "Terms", "Cookies", "Accessibility"].map((l) => (
                <Link key={l} to="/info/$slug" params={{ slug: slugify(l) }} className="foot-link"><Bold t={l} /></Link>
              ))}
              <button type="button" className="foot-link ml-2 items-center gap-1.5" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                <Bold t="Back to top" /><ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div aria-hidden="true" className="footer-word relative mt-6 select-none whitespace-nowrap text-center font-display">{BRAND.name}</div>
        </div>
      </footer>
    </div>
  );
}

/** Wraps a Webbora-style page: its own header (by section) and the shared Webbora scope. */
export function WbPage({ slug, children, bg }: { slug: string; children: ReactNode; bg?: "legal" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useReveal(pathname);
  const cfg = headerFor(slug);
  return (
    <div className="wb wb-page" data-section={cfg.kind}>
      <div className="site-shell overflow-x-clip bg-surface text-foreground">
        <WbHeader cfg={cfg} slug={slug} />
        <main id="main">{children}</main>
        {bg === "legal" && null}
      </div>
    </div>
  );
}

/** Webbora-styled content under the normal Hodii header (used by Tools and Compare, which are property pages). */
export function WbBody({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useReveal(pathname);
  return (
    <div className="wb wb-page wb-body" data-section="tools">
      <div className="site-shell overflow-x-clip text-foreground" style={{ background: "transparent" }}>
        <main id="main">{children}</main>
      </div>
    </div>
  );
}
