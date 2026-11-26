import { Link, useNavigate } from "@tanstack/react-router";
import { Car } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader } from "@/components/loader";
import { HodiiLogo } from "@/components/brand-logo";
import { BRAND } from "@/lib/brand";
import { IconHint } from "@/components/property/icon-hint";
import { OPEN_LISTING_SEARCH } from "@/components/property/listing-search";
import { BLUE_GRADIENT_H, PhoneGlyph, SendGlyph, WhatsAppGlyph } from "@/components/property/dock-icons";
import { useAuth } from "@/hooks/use-auth";
import { useCompare } from "@/lib/compare";
import { formatArea, formatPrice, listingTypeLabel, propertyTypeLabel } from "@/lib/format";
import { directionsUrl } from "@/lib/geo";
import { toggleSavedListing } from "@/lib/properties.functions";
import type { PropertyDetail } from "@/lib/property-dto";
import { visitorId } from "@/lib/visitor";

type Shortcut = { id: string; label: string };

export function MobileListingTopBar({ p }: { p: PropertyDetail }) {
  const compareCount = useCompare().length;
  const dealLabel = listingTypeLabel(p.listingType);
  const typeLabel = propertyTypeLabel(p.propertyType);
  const thirdLabel = p.areaName || p.county || (p.category ? p.category[0]!.toUpperCase() + p.category.slice(1) : "Kenya");
  const thirdSearch: Record<string, string> = p.location.countySlug
    ? { county: p.location.countySlug, ...(p.areaName ? { q: p.areaName } : {}) }
    : p.areaName ? { q: p.areaName } : {};

  const pill = "ld-pill shrink-0 whitespace-nowrap";
  return (
    <div className="ld-font sticky top-0 z-40 bg-black lg:hidden"><div className="mx-auto flex w-full max-w-[82rem] items-center px-1.5 py-3 md:px-4 md:py-3.5">
      <Link to="/" aria-label={`${BRAND.name} home`} className="mr-3 hidden shrink-0 items-center gap-2.5 text-white md:flex"><HodiiLogo /><span className="brand-word font-display text-[1.2rem] font-semibold leading-none">{BRAND.name}</span></Link>
      <button type="button" aria-label="Filters" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new Event(OPEN_LISTING_SEARCH))} style={{ color: "#ffffff" }} className="grid size-10 shrink-0 place-items-center active:scale-95">
        <svg viewBox="0 0 28 28" className="size-[26px]" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden>
          <path d="M3 8h11M22 8h3M3 20h3M14 20h11" />
          <circle cx="18" cy="8" r="3.4" />
          <circle cx="10" cy="20" r="3.4" />
        </svg>
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-[10px] overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)", maskImage: "linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)" }}>
        <Link to="/properties" search={{ for: p.listingType }} className={`${pill} ld-pill-on`}>{dealLabel}</Link>
        <Link to="/properties" search={{ type: p.propertyType }} className={pill}>{typeLabel}</Link>
        <Link to="/properties" search={thirdSearch} className={pill}>{thirdLabel}</Link>
        {p.county && p.areaName && p.location.countySlug && <Link to="/properties" search={{ county: p.location.countySlug }} className={pill}>{p.county}</Link>}
        {p.bedrooms !== null && p.bedrooms > 0 && <Link to="/properties" search={{ for: p.listingType, type: p.propertyType, ...(p.location.countySlug ? { county: p.location.countySlug } : {}) }} className={pill}>{p.bedrooms} Bed {typeLabel}</Link>}
        {p.category && <Link to="/properties" search={{ q: p.category }} className={pill}>{p.category[0]!.toUpperCase() + p.category.slice(1)}</Link>}
      </div>
      <button type="button" data-menu-trigger aria-label="Open menu" onClick={() => window.dispatchEvent(new CustomEvent("hodii:toggle-menu"))} className="relative grid size-10 shrink-0 place-items-center text-white active:scale-95">
        <svg viewBox="0 0 24 24" className="size-[26px]" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden><path d="M4 6.5h16M10 12h10M14 17.5h6" /></svg>
        {compareCount > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-[var(--ld-pink)]" aria-hidden />}
      </button>
    </div></div>
  );
}

/** Fixed action dock: sits above the tab bar, fades out while scrolling and back in when scrolling stops. */
function useScrollFade() {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 12) return;
      setShown(y < last || y < 60);
      last = y;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.documentElement.dataset["dock"] = shown ? "shown" : "hidden";
    return () => { delete document.documentElement.dataset["dock"]; };
  }, [shown]);
  return shown;
}

export function MobileListingHeroBody({
  p,
  isSaved,
  onSavedChange,
  shown,
  busy,
  onReveal,
  shortcuts,
}: {
  p: PropertyDetail;
  isSaved: boolean;
  onSavedChange: (v: boolean) => void;
  shown: { phone: string; whatsapp: string } | null;
  busy: "phone" | "whatsapp" | null;
  onReveal: (via: "phone" | "whatsapp") => Promise<void>;
  shortcuts: Shortcut[];
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [activeShort, setActiveShort] = useState(shortcuts[0]?.id ?? "");
  const dockShown = useScrollFade();

  const scrollTo = (id: string, focusInput = false) => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focusInput) {
      setTimeout(() => { el.querySelector<HTMLElement>("input,textarea")?.focus({ preventScroll: true }); }, 350);
    }
    return true;
  };

  const handleSave = async () => {
    if (!user) { navigate({ to: "/auth", search: { redirect: window.location.pathname + window.location.search } }); return; }
    const next = !isSaved;
    setSaving(true);
    onSavedChange(next);
    try {
      const r = await toggleSavedListing({ data: { propertyId: p.id, visitorId: visitorId() } });
      onSavedChange(r.saved);
      toast.success(r.saved ? "Saved to your account" : "Removed from saved");
      qc.invalidateQueries({ queryKey: ["saved"] });
    } catch (err) {
      onSavedChange(!next);
      toast.error(err instanceof Error ? err.message : "Could not save this listing");
    } finally { setSaving(false); }
  };

  const handleLocation = () => {
    if (scrollTo("map") || scrollTo("near")) return;
    if (p.location.point) window.open(directionsUrl(p.location.point.lat, p.location.point.lng), "_blank", "noopener,noreferrer");
    else toast("Location details are shown below");
  };

  // After the number is revealed, bring the Agent phone card into the middle of the screen so it is never left out of sight.
  const wantPhoneScroll = useRef(false);
  useEffect(() => {
    if (!shown?.phone || !wantPhoneScroll.current) return;
    wantPhoneScroll.current = false;
    const t = setTimeout(() => document.getElementById("agent-phone")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    return () => clearTimeout(t);
  }, [shown?.phone]);

  const handlePhone = async () => {
    if (shown?.phone) {
      window.location.href = `tel:${shown.phone}`;
      return;
    }
    wantPhoneScroll.current = true;
    await onReveal("phone");
    if (!document.getElementById("agent-phone")) wantPhoneScroll.current = false;
  };

  const locText = [p.areaName, p.county].filter(Boolean).join(", ");
  const bedText = p.bedrooms === null ? null : p.bedrooms === 0 ? "Studio" : `${p.bedrooms} ${p.bedrooms === 1 ? "Bed" : "Beds"}`;
  const bathText = p.bathrooms === null ? null : `${p.bathrooms} ${p.bathrooms === 1 ? "Bath" : "Baths"}`;
  const sizeText = p.sizeSqm ? formatArea(p.sizeSqm) : null;
  const parkText = !sizeText && p.parking !== null ? `${p.parking} Parking` : null;
  const desc = (p.description || "").replace(/\s+/g, " ").trim();

  return (
    <div className="ld-font">
      {/* Pulled up over the photo by exactly two title lines (2 x 1.42rem x 1.2), so the photo's fade ends where line 2 ends. */}
      <div className="relative z-[2] -mt-[2.45rem] px-4 pb-3 md:mt-4 md:px-8 lg:mt-4 lg:px-0 lg:max-w-[52rem]">
        <div className="pointer-events-none flex min-h-[3.408rem] items-end md:hidden">
          <h1 className="line-clamp-2 text-[1.42rem] font-bold leading-[1.2] text-white md:text-[1.75rem] md:leading-[1.2]">{p.title}</h1>
        </div>
        {desc && <p className="mt-2 line-clamp-3 text-[1.03rem] md:mt-3 md:line-clamp-4 md:text-[1.1rem] font-normal leading-[1.38] text-[#c9c9cc]">{desc}</p>}

        <div className="mt-6 flex min-w-0 flex-nowrap items-center gap-5 whitespace-nowrap md:hidden">
          <p className="min-w-0 shrink truncate text-[clamp(1.05rem,5.9vw,1.4rem)] md:text-[1.6rem] font-bold leading-tight text-[#52e36b]">{formatPrice(p.price)}</p>
          {locText && (
            <>
              <span className="h-[22px] w-[1.5px] shrink-0 bg-[#9a9a9e]" aria-hidden />
              <p className="flex min-w-0 shrink items-center gap-2.5 text-[clamp(0.9rem,4.6vw,1.08rem)] md:text-[1.1rem] font-normal text-white">
                <svg viewBox="0 0 24 24" className="size-[1.15em] shrink-0" aria-hidden><path fill="#fff" d="M12 1.8a7.6 7.6 0 0 0-7.6 7.6c0 5.6 7.6 13 7.6 13s7.6-7.4 7.6-13A7.6 7.6 0 0 0 12 1.8Zm0 10.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" /></svg>
                <span className="truncate">{locText}</span>
              </p>
            </>
          )}
        </div>

        {(bedText || bathText || sizeText || parkText) && (
          <div className="mt-6 flex flex-nowrap items-center justify-between gap-5 whitespace-nowrap text-[clamp(0.85rem,4.4vw,1.02rem)] md:hidden md:justify-start md:gap-10 md:text-[1.05rem] font-normal text-white">
            {bedText && <span className="inline-flex min-w-0 items-center gap-3"><svg viewBox="0 0 28 20" className="h-[1.1em] w-[1.55em] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden><path d="M2 3v15M26 11v7M2 15h24M2 11h24M6 11V7.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V11M15 11V7.5A1.5 1.5 0 0 1 16.5 6h4A1.5 1.5 0 0 1 22 7.5V11" /></svg><span className="truncate">{bedText}</span></span>}
            {bathText && <span className="inline-flex min-w-0 items-center gap-3"><svg viewBox="0 0 26 22" className="h-[1.2em] w-[1.4em] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 11h22M4 11v3.5A5.5 5.5 0 0 0 9.5 20h7a5.5 5.5 0 0 0 5.5-5.5V11M7 20l-1 1.5M19 20l1 1.5M6 11V4.5A2.5 2.5 0 0 1 8.5 2c1.2 0 2 .8 2.3 1.8M9 5.5h3.5" /></svg><span className="truncate">{bathText}</span></span>}
            {sizeText && <span className="inline-flex min-w-0 items-center gap-3"><svg viewBox="0 0 24 24" className="size-[1.2em] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M3 3l5 5M21 3l-5 5M21 21l-5-5M3 21l5-5" /></svg><span className="truncate">{sizeText}</span></span>}
            {parkText && <span className="inline-flex min-w-0 items-center gap-3"><Car className="size-[1.2em] shrink-0" strokeWidth={1.9} aria-hidden /><span className="truncate">{parkText}</span></span>}
          </div>
        )}
      </div>

      <div className={`listing-dock pointer-events-none fixed inset-x-0 z-[44] px-3.5 pb-3 pt-10 transition-[opacity,transform] duration-700 ease-in-out md:pointer-events-auto md:static md:z-auto md:px-8 md:pb-2 md:pt-4 md:!translate-y-0 md:!bg-none md:!opacity-100 ${dockShown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`} style={{ bottom: "var(--tab-h, 58px)", background: "linear-gradient(to bottom, rgb(0 0 0 / 0) 0%, rgb(0 0 0 / 0.55) 38%, rgb(0 0 0 / 0.92) 72%, #000 100%)" }}>
        <div className={`flex items-center justify-between md:pointer-events-auto md:max-w-[30rem] md:justify-start md:gap-7 ${dockShown ? "pointer-events-auto" : "pointer-events-none"}`}>
          <IconHint label="View location" side="top">
            <button type="button" onClick={handleLocation} aria-label="View location" className="ld-action-btn ld-action-sm">
              <svg viewBox="0 0 32 32" className="size-[24px]" aria-hidden>
                <ellipse cx="16" cy="27.5" rx="7.5" ry="2.6" fill="none" stroke="#f5b50a" strokeWidth="2.2" />
                <path fill="#f5b50a" d="M16 2.5a9.2 9.2 0 0 0-9.2 9.2c0 6.6 9.2 15.3 9.2 15.3s9.2-8.7 9.2-15.3A9.2 9.2 0 0 0 16 2.5Z" />
                <circle cx="16" cy="11.6" r="3.6" fill="#1c1c1e" />
              </svg>
            </button>
          </IconHint>
          <IconHint label={isSaved ? "Remove from saved" : "Save this property"} side="top">
            <button type="button" onClick={handleSave} disabled={saving} aria-pressed={isSaved} aria-label={isSaved ? "Remove from saved" : "Save this property"} className="ld-action-btn ld-action-lg">
              <svg viewBox="0 0 32 32" className="size-[34px]" aria-hidden><path fill={isSaved ? "#ff2d78" : "#ff3d86"} d="M16 28.2S3 20.4 3 11.4A6.9 6.9 0 0 1 9.9 4.5c2.6 0 4.8 1.4 6.1 3.4 1.3-2 3.5-3.4 6.1-3.4A6.9 6.9 0 0 1 29 11.4c0 9-13 16.8-13 16.8Z" /></svg>
            </button>
          </IconHint>
          <IconHint label={shown?.phone ? "Call the agent" : "Show phone number"} side="top">
            <button type="button" onClick={handlePhone} disabled={busy !== null} aria-label={shown?.phone ? `Call ${shown.phone}` : "Show phone number"} className="ld-action-btn ld-action-sm disabled:opacity-60">
              {busy === "phone" ? <Loader size="xs" /> : <PhoneGlyph className="size-[24px]" />}
            </button>
          </IconHint>
          <IconHint label="Contact on WhatsApp" side="top">
            <button type="button" onClick={() => onReveal("whatsapp")} disabled={busy !== null} aria-label="Contact on WhatsApp" className="ld-action-btn ld-action-lg disabled:opacity-60">
              {busy === "whatsapp" ? <Loader size="xs" /> : <WhatsAppGlyph className="size-[34px]" />}
            </button>
          </IconHint>
          <IconHint label="Send an enquiry" side="top">
            <button type="button" onClick={() => scrollTo("enquiry-form", true) || scrollTo("contact")} aria-label="Send an enquiry" className="ld-action-btn ld-action-sm">
              <SendGlyph className="size-[24px]" />
            </button>
          </IconHint>
        </div>
      </div>

      <div className={`px-3 md:px-6 ${shown?.phone ? "pb-7" : "pb-2"}`}>
        {shown?.phone && (
          <div id="agent-phone" className="mt-7 flex scroll-mt-24 items-center md:max-w-[30rem] justify-between gap-3 rounded-2xl border border-white/10 bg-[var(--ld-surface)] px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-400">Agent phone</p>
              <p className="truncate text-sm font-bold text-white">{shown.phone}</p>
            </div>
            <a href={`tel:${shown.phone}`} style={{ background: BLUE_GRADIENT_H }} className="shrink-0 rounded-full px-4 py-1.5 text-xs font-extrabold text-white">Call now</a>
          </div>
        )}
      </div>

      {/* 4 quick-jump shortcut pills to scroll down to the cards below */}
      {shortcuts.length > 0 && (
        <div className="border-t border-white/[0.08] px-3 py-3 md:px-6">
          <div className="grid grid-cols-4 gap-1.5 md:max-w-[30rem] md:gap-2">
            {shortcuts.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setActiveShort(s.id); scrollTo(s.id); }}
                className={`truncate rounded-full border px-2 py-1.5 text-center text-[12px] font-semibold transition active:scale-95 ${activeShort === s.id ? "border-white/25 bg-card/10 text-white" : "border-white/15 bg-[var(--ld-surface)] text-zinc-300"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}