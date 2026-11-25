import { LISTING_TYPES, PROPERTY_TYPES, type PricePeriod } from "./mongodb/taxonomy";

/** Display helpers shared by the pages. Pure, no browser or server APIs. */
const PERIOD_SUFFIX: Record<PricePeriod, string> = { total: "", month: " / month", year: " / year", week: " / week", night: " / night" };

export type PriceLike = { amount: number; currency: string; period: string; negotiable?: boolean };

/** "KES 120,000 / month". */
export function formatPrice(p: PriceLike | null | undefined, opts: { compact?: boolean } = {}) {
  if (!p) return "Price on request";
  const n = opts.compact ? compactNumber(p.amount) : p.amount.toLocaleString("en-KE");
  return `${p.currency} ${n}${PERIOD_SUFFIX[p.period as PricePeriod] ?? ""}`;
}

/** 12_500_000 → "12.5M", 450_000 → "450K", 8_000 → "8,000". */
export function compactNumber(n: number) {
  const fmt = (v: number, unit: string) => `${Number.isInteger(v) ? v : Math.round(v * 10) / 10}${unit}`;
  if (n >= 1_000_000_000) return fmt(n / 1_000_000_000, "B");
  if (n >= 1_000_000) return fmt(n / 1_000_000, "M");
  if (n >= 100_000) return fmt(n / 1000, "K");
  return n.toLocaleString("en-KE");
}

export const listingTypeLabel = (key: string) => LISTING_TYPES.find((t) => t.key === key)?.label ?? key;
export const propertyTypeLabel = (key: string) => PROPERTY_TYPES.find((t) => t.key === key)?.label ?? key;

/** "3 bed · 2 bath · 140 m²" for the facts shown on cards. */
export function factsLine(f: { bedrooms: number | null; bathrooms: number | null; sizeSqm: number | null; propertyType?: string }) {
  const out: string[] = [];
  if (f.bedrooms !== null) out.push(f.bedrooms === 0 ? "Studio" : `${f.bedrooms} bed`);
  if (f.bathrooms !== null) out.push(`${f.bathrooms} bath`);
  if (f.sizeSqm) out.push(formatArea(f.sizeSqm));
  return out.join(" · ");
}

/** Land is shown in acres from half an acre up, otherwise square metres. */
export function formatArea(sqm: number) {
  if (sqm >= 2023) { const acres = sqm / 4046.8564224; return `${acres >= 10 ? Math.round(acres) : Math.round(acres * 100) / 100} acres`; }
  return `${Math.round(sqm).toLocaleString("en-KE")} m²`;
}

export function timeAgo(iso: string | null, now = Date.now()) {
  if (!iso) return "";
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/** One plain sentence built from the listing's facts, used on cards instead of the seller's own title: "2-bedroom, 2-bath apartment for rent in Kilimani". */
export function describeListing(p: { listingType: string; propertyType: string; bedrooms: number | null; bathrooms: number | null; sizeSqm: number | null; areaName: string; county: string | null }) {
  const type = propertyTypeLabel(p.propertyType).toLowerCase();
  const deal = p.listingType === "short_stay" ? "for short stay" : p.listingType === "rent" ? "for rent" : "for sale";
  const parts: string[] = [];
  if (p.bedrooms === 0) parts.push("Studio");
  else if (p.bedrooms) parts.push(`${p.bedrooms}-bedroom`);
  if (p.bathrooms) parts.push(`${p.bathrooms}-bath`);
  const lead = parts.join(", ");
  const size = !p.bedrooms && p.bedrooms !== 0 && p.sizeSqm ? `${formatArea(p.sizeSqm)} ` : "";
  const place = p.areaName || p.county || "";
  const s = `${lead ? lead + " " : ""}${size}${type} ${deal}${place ? ` in ${place}` : ""}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
