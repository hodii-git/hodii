import { COUNTY_LIST } from "./mongodb/kenya";
import { FEATURES, FURNISHINGS, LISTING_TYPES, PROPERTY_TYPES } from "./mongodb/taxonomy";
import type { SearchParams } from "./listing-search";

/** The filters, as short readable pieces: one entry per filter, so two searches can be compared. */
export type Chip = { key: string; label: string };
const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

export function criteriaChips(c: Partial<SearchParams>): Chip[] {
  const out: Chip[] = [];
  if (c.listingType) out.push({ key: "listingType", label: LISTING_TYPES.find((t) => t.key === c.listingType)?.label ?? c.listingType });
  if (c.countyCodes?.length) out.push({ key: "countyCodes", label: c.countyCodes.map((n) => COUNTY_LIST.find((k) => k.code === n)?.name ?? String(n)).join(" or ") });
  if (c.q) out.push({ key: "q", label: `“${c.q}”` });
  if (c.circle) out.push({ key: "circle", label: `Within ${c.circle.radiusM >= 1000 ? `${Math.round(c.circle.radiusM / 100) / 10} km` : `${c.circle.radiusM} m`} of a pin` });
  if (c.polygon) out.push({ key: "polygon", label: "Inside the drawn area" });
  if (c.propertyTypes?.length) out.push({ key: "propertyTypes", label: c.propertyTypes.map((k) => PROPERTY_TYPES.find((t) => t.key === k)?.label ?? k).join(" or ") });
  if (c.bedroomsMin !== undefined) out.push({ key: "bedroomsMin", label: `${c.bedroomsMin}+ bedrooms` });
  if (c.bathroomsMin !== undefined) out.push({ key: "bathroomsMin", label: `${c.bathroomsMin}+ bathrooms` });
  if (c.priceMin !== undefined && c.priceMax !== undefined) out.push({ key: "price", label: `${kes(c.priceMin)} to ${kes(c.priceMax)}` });
  else if (c.priceMax !== undefined) out.push({ key: "price", label: `Up to ${kes(c.priceMax)}` });
  else if (c.priceMin !== undefined) out.push({ key: "price", label: `From ${kes(c.priceMin)}` });
  for (const f of c.features ?? []) out.push({ key: `feature:${f}`, label: FEATURES.find((x) => x.key === f)?.label ?? f });
  if (c.furnishing) out.push({ key: "furnishing", label: FURNISHINGS.find((x) => x.key === c.furnishing)?.label ?? c.furnishing });
  if (c.verifiedOnly) out.push({ key: "verifiedOnly", label: "Verified only" });
  return out;
}

export type Change = { kind: "added" | "changed" | "removed"; chip: Chip; was?: string };
/** What the last message did to the filters. */
export function diffChips(before: Chip[], after: Chip[]): Change[] {
  const b = new Map(before.map((c) => [c.key, c])), a = new Map(after.map((c) => [c.key, c]));
  const out: Change[] = [];
  for (const c of after) { const o = b.get(c.key); if (!o) out.push({ kind: "added", chip: c }); else if (o.label !== c.label) out.push({ kind: "changed", chip: c, was: o.label }); }
  for (const c of before) if (!a.has(c.key)) out.push({ kind: "removed", chip: c });
  return out;
}

/** Everything a search can narrow by, set to nothing. Used by "Clear all". */
export const CLEAR_ALL: Partial<SearchParams> = {
  q: undefined, listingType: undefined, category: undefined, propertyTypes: undefined, countyCodes: undefined, areaSlugs: undefined,
  priceMin: undefined, priceMax: undefined, bedroomsMin: undefined, bathroomsMin: undefined, areaSqmMin: undefined, areaSqmMax: undefined,
  features: undefined, furnishing: undefined, conditions: undefined, verifiedOnly: undefined, circle: undefined, polygon: undefined, page: 1,
};
export const hasFilters = (p: Partial<SearchParams>) => criteriaChips(p).length > 0 || !!p.category || !!p.conditions?.length || !!p.areaSqmMin || !!p.areaSqmMax || !!p.areaSlugs?.length;
