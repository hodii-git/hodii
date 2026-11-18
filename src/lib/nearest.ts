import type { SearchParams } from "./listing-search";

/**
 * When nothing matches, loosen the search one step at a time (most optional first) until something does.
 * Each step keeps the earlier loosening, and says in plain words what was relaxed so the page can tell the person.
 */
export type Relax = { label: string; params: SearchParams };

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
  if (cur.q) add("your keywords", { q: undefined });
  if (cur.countyCodes?.length) add("the county", { countyCodes: undefined });
  return steps;
}
