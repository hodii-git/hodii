import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { HodiiLogo } from "@/components/brand-logo";
import { WbFooter } from "@/components/wb/shell";
import { BRAND } from "@/lib/brand";

const L = Link as unknown as ComponentType<Record<string, unknown>>;

export type SideItem = {
  key: string; label: string; icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  to?: string; params?: Record<string, string>; exact?: boolean; active?: boolean; onClick?: () => void;
  badge?: number; tour?: string; danger?: boolean;
  /** A filled button-style row, for the main action such as Add listing. */
  cta?: boolean;
  /** Rows that open underneath this one when it is clicked. */
  sub?: { key: string; label: string; to: string; params?: Record<string, string> }[];
};
export type SideGroup = { title?: string; items: SideItem[] };

const MOBILE = "(max-width: 1023px)";

/**
 * The frame every management area uses: a full-height menu on the left (it never scrolls and always has a collapse
 * button at the bottom), and on the right a header, the page and the footer. On phones the menu stays on the side
 * as a narrow icon strip and opens over the page when you tap the arrow.
 */
export function DashFrame({ brand, groups, bar, children, footer = "site", extra, label }: {
  brand: ReactNode; groups: SideGroup[]; bar: ReactNode; children: ReactNode; footer?: "site" | "slim"; extra?: ReactNode; label: string;
}) {
  const [open, setOpen] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null);
  // Phones: the slim rail can be hidden completely, and comes back only when the person opens it.
  const [gone, setGone] = useState(false);
  useEffect(() => { try { setGone(localStorage.getItem("hodii.side.gone") === "1"); } catch { /* private mode */ } }, []);
  const setHidden = (v: boolean) => { setGone(v); try { localStorage.setItem("hodii.side.gone", v ? "1" : "0"); } catch { /* private mode */ } };
  useEffect(() => {
    const mq = window.matchMedia(MOBILE);
    const apply = () => {
      setMobile(mq.matches);
      if (mq.matches) setOpen(false);
      else { try { setOpen(localStorage.getItem("hodii.side") !== "1"); } catch { setOpen(true); } }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const toggle = () => setOpen((o) => { if (!mobile) { try { localStorage.setItem("hodii.side", o ? "1" : "0"); } catch { /* private mode */ } } return !o; });
  const overlay = mobile && open;
  const hiddenAll = mobile && gone && !open;
  const wide = open;

  const row = (it: SideItem) => {
    if (it.sub) {
      const isOpen = openSub === it.key && wide;
      return (
        <div key={it.key}>
          <button type="button" title={it.label} aria-expanded={isOpen} onClick={() => { if (!wide) { setOpen(true); setOpenSub(it.key); } else setOpenSub(isOpen ? null : it.key); }}
            className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground ${wide ? "" : "justify-center px-0"}`}>
            <it.icon className="size-[19px] shrink-0" aria-hidden />
            {wide && <><span className="truncate">{it.label}</span><ChevronDown className={`ml-auto size-4 transition ${isOpen ? "rotate-180" : ""}`} aria-hidden /></>}
          </button>
          {isOpen && <div className="ml-3 mt-2 space-y-2">
            {it.sub.map((s) => <L key={s.key} to={s.to} {...(s.params ? { params: s.params } : {})} onClick={() => mobile && setOpen(false)} className="pill-soft flex h-10 items-center gap-2 rounded-full bg-card px-2 pr-4 text-sm font-semibold text-foreground" activeProps={{ className: "pill-soft flex h-10 items-center gap-2 rounded-full bg-primary px-2 pr-4 text-sm font-bold text-primary-foreground" }}><span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-xs font-extrabold">{s.label.slice(0, 1).toUpperCase()}</span><span className="truncate">{s.label}</span></L>)}
          </div>}
        </div>
      );
    }
    if (it.cta) {
      return <L key={it.key} to={it.to} {...(it.params ? { params: it.params } : {})} title={it.label} data-tour={it.tour} onClick={() => mobile && setOpen(false)}
        className={`flex h-11 items-center gap-3 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 ${wide ? "" : "justify-center px-0"}`}><it.icon className="size-[19px] shrink-0" aria-hidden />{wide && <span className="truncate">{it.label}</span>}{!wide && <span className="sr-only">{it.label}</span>}</L>;
    }
    const base = `relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${wide ? "" : "justify-center px-0"} ${it.danger ? "text-red-600 hover:bg-red-50" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}`;
    const on = "bg-foreground/10 !text-primary";
    const inner = (
      <>
        <it.icon className="size-[19px] shrink-0" aria-hidden />
        {wide && <span className="truncate">{it.label}</span>}
        {!!it.badge && it.badge > 0 && (wide
          ? <span className="ml-auto rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{it.badge}</span>
          : <span aria-hidden className="absolute right-2 top-1.5 size-2 rounded-full bg-primary" />)}
        {!wide && <span className="sr-only">{it.label}{it.badge ? `, ${it.badge}` : ""}</span>}
      </>
    );
    if (it.to) {
      return <L key={it.key} to={it.to} {...(it.params ? { params: it.params } : {})} activeOptions={{ exact: !!it.exact }} title={it.label} data-tour={it.tour} onClick={() => mobile && setOpen(false)}
        className={base} activeProps={{ className: `${base} ${on}`, "aria-current": "page" }}>{inner}</L>;
    }
    return <button key={it.key} type="button" title={it.label} data-tour={it.tour} aria-current={it.active ? "page" : undefined} onClick={() => { it.onClick?.(); if (mobile) setOpen(false); }} className={`w-full ${base} ${it.active ? on : ""}`}>{inner}</button>;
  };

  return (
    <div className="dash-frame flex min-h-dvh w-full">
      {overlay && <button type="button" aria-label="Close menu" className="fixed inset-0 z-[55] bg-black/30" onClick={() => setOpen(false)} />}
      {/* The spacer keeps the page from jumping when the menu opens over it on a phone. */}
      <div className={`relative shrink-0 transition-[width] duration-300 ${hiddenAll ? "w-0 overflow-hidden" : mobile ? "w-[4.25rem]" : open ? "w-[16.5rem]" : "w-[4.5rem]"}`}>
        <aside aria-label={label} className={`dash-side flex flex-col border-r border-border bg-card/95 backdrop-blur-xl transition-[width] duration-300 ${overlay ? "fixed inset-y-0 left-0 z-[60] w-[17rem] !bg-card shadow-2xl" : "sticky top-0 h-dvh w-full"}`}>
          <div className={`flex h-16 shrink-0 items-center gap-3 border-b border-border ${wide ? "px-4" : "justify-center"}`}>
            <L to="/" aria-label={`${BRAND.name} home`} className="flex items-center gap-2 font-extrabold"><HodiiLogo />{wide && <span className="brand-word text-xl">{BRAND.name}</span>}</L>
          </div>
          {wide && <div className="shrink-0 px-3 pt-3">{brand}</div>}
          <nav aria-label={label} className="dash-nav min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-2.5 pad-fixed">
            {groups.map((g, i) => g.items.length > 0 && (
              <div key={g.title ?? i} className="space-y-1">
                {g.title && wide && <p className="px-3 pb-1 text-[11px] font-bold uppercase text-muted-foreground">{g.title}</p>}
                {g.items.map(row)}
              </div>
            ))}
            {extra && wide && <div className="space-y-2 pt-1">{extra}</div>}
          </nav>
          <div className="shrink-0 space-y-1 border-t border-border p-2.5">
            {mobile && <button type="button" onClick={() => { setHidden(true); setOpen(false); }} aria-label="Hide the menu completely"
              className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground ${wide ? "" : "justify-center px-0"}`}>
              <X className="size-[19px] shrink-0" aria-hidden />{wide && <span>Hide menu</span>}
            </button>}
            <button type="button" onClick={toggle} aria-expanded={open} aria-label={open ? "Collapse menu" : "Expand menu"}
              className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground ${wide ? "" : "justify-center px-0"}`}>
              {open ? <PanelLeftClose className="size-[19px] shrink-0" aria-hidden /> : <PanelLeftOpen className="size-[19px] shrink-0" aria-hidden />}
              {wide && <span>Collapse menu</span>}
            </button>
          </div>
        </aside>
      </div>
      <div className="flex min-w-0 flex-1 flex-col" style={{ ["--site-w" as string]: "100%" }}>
        {bar}
        <main id="main" className="mx-auto w-full max-w-[96rem] flex-1 px-4 pb-16 pt-6 md:px-8">
          {hiddenAll && <button type="button" onClick={() => { setHidden(false); setOpen(true); }} className="mb-4 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold shadow-sm"><Menu className="size-4" aria-hidden />Menu</button>}
          {children}
        </main>
        {footer === "site"
          ? <div className="px-3 md:px-6"><WbFooter /></div>
          : <footer className="px-4 pb-6 text-center text-xs text-muted-foreground md:px-8">© {new Date().getFullYear()} {BRAND.legalName}</footer>}
      </div>
    </div>
  );
}
