import type { SearchParams } from "./listing-search";

/**
 * When nothing matches, loosen the search one step at a time (most optional first) until something does.
 * Each step keeps the earlier loosening, and says in plain words what was relaxed so the page can tell the person.
 */
export type Relax = { label: string; params: SearchParams };

/** Counties that share a border or a short commute, by county number. Used to widen a search to nearby places, never to the whole country. */
const NEXT_TO: Record<number, number[]> = {
  47: [22, 34, 16], 22: [47, 21, 18, 32, 16], 34: [47, 16, 33], 16: [47, 34, 17, 15, 22], 1: [3, 2], 2: [1, 6], 3: [1, 4, 5], 32: [22, 18, 33, 35, 30, 31], 42: [43, 41, 29, 35], 27: [26, 29, 28], 12: [11, 13, 31, 19], 19: [18, 20, 31, 21], 31: [19, 12, 30, 32], 21: [22, 19, 20, 18], 14: [20, 13, 16, 15],
};
export const neighbours = (codes: number[]) => [...new Set(codes.flatMap((c) => NEXT_TO[c] ?? []))].filter((c) => !codes.includes(c)).slice(0, 6);

export function relaxations(p: SearchParams): Relax[] {
  const steps: Relax[] = [];
  let cur: SearchParams = { ...p };
  const add = (label: string, change: Partial<SearchParams>) => { cur = { ...cur, ...change, page: 1 }; steps.push({ label, params: cur }); };
  if (cur.features?.length || cur.furnishing || cur.conditions?.length || cur.verifiedOnly) add("extra requirements", { features: undefined, furnishing: undefined, conditions: undefined, verifiedOnly: undefined });
  if (cur.bathroomsMin) add("bathrooms", { bathroomsMin: undefined });
  if (cur.areaSqmMin || cur.areaSqmMax) add("size", { areaSqmMin: undefined, areaSqmMax: undefined });
  if (cur.bedroomsMin) add(cur.bedroomsMin > 1 ? "one fewer bedroom" : "bedrooms", { bedroomsMin: cur.bedroomsMin > 1 ? cur.bedroomsMin - 1 : undefined });
  if (cur.priceMax || cur.priceMin) add("a slightly wider price range", { ...(cur.priceMax ? { priceMax: Math.round(cur.priceMax * 1.3) } : {}), ...(cur.priceMin ? { priceMin: Math.round(cur.priceMin * 0.7) } : {}) });
  if (cur.propertyTypes?.length) add("property type", { propertyTypes: undefined });
  if (cur.q) add(cur.countyCodes?.length ? "the exact area (showing the rest of the county)" : "your keywords", { q: undefined });
  if (cur.countyCodes?.length) {
    const near = neighbours(cur.countyCodes);
    if (near.length) add("the county (showing nearby counties too)", { countyCodes: [...cur.countyCodes, ...near] });
  }
  return steps;
}
