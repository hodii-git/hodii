import type { PickOption } from "@/components/ui/pick";
import { COUNTY_LIST, REGIONS } from "./mongodb/kenya";
import { PROPERTY_CATEGORIES, PROPERTY_TYPES } from "./mongodb/taxonomy";

/** Nairobi first, then counties grouped by region: the region opens its own list of counties. Values are the county codes. */
export const COUNTY_OPTIONS: PickOption[] = [{ value: "47", label: "Nairobi" }, ...REGIONS.map((r) => ({
  label: r.name,
  children: r.counties.filter((code) => code !== 47).flatMap((code) => { const c = COUNTY_LIST.find((k) => k.code === code); return c ? [{ value: String(c.code), label: c.name }] : []; }),
}))];

/** Category, with its property types inside. Values: "cat:residential" for a whole category, "type:apartment" for one type. */
export const CATEGORY_TYPE_OPTIONS: PickOption[] = PROPERTY_CATEGORIES.map((c) => ({
  value: `cat:${c.key}`, label: c.label,
  children: PROPERTY_TYPES.filter((t) => t.category === c.key).map((t) => ({ value: `type:${t.key}`, label: t.label })),
}));

export const toOptions = <T extends { key: string; label: string }>(xs: readonly T[]): PickOption[] => xs.map((x) => ({ value: x.key, label: x.label }));
