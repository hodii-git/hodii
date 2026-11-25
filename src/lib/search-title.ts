import { COUNTY_LIST } from "./mongodb/kenya";
import { PROPERTY_TYPES } from "./mongodb/taxonomy";
import type { SearchParams } from "./listing-search";

/** Words for the top of the results page, taken from what was actually searched, so the page says what it shows. */
const FILLER = new Set(["a", "an", "the", "and", "or", "with", "at", "atleast", "least", "more", "less", "than", "for", "in", "near", "of", "to", "on", "price", "negotiable", "fully", "very", "nice", "good", "i", "want", "need", "looking", "find", "me", "some", "any", "please"]);
/** Only the words that say what is wanted, at most three, so a long sentence never fills the page heading. */
const keyWords = (q: string) => { const w = q.split(/\s+/).map((x) => x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter((x) => x && !FILLER.has(x.toLowerCase())); const out = w.slice(0, 3).join(" "); return out.length > 28 ? `${out.slice(0, 27).trimEnd()}…` : out; };

export function searchHeading(p: Partial<SearchParams>): { title: string; subtitle: string } {
  const county = p.countyCodes?.length ? p.countyCodes.map((c) => COUNTY_LIST.find((k) => k.code === c)?.name).filter(Boolean).slice(0, 2).join(" or ") : "";
  const types = (p.propertyTypes ?? []).map((t) => PROPERTY_TYPES.find((x) => x.key === t)).filter((t): t is NonNullable<typeof t> => !!t);
  const what = types.length === 1 ? types[0]!.plural : types.length === 2 ? `${types[0]!.plural} and ${types[1]!.plural.toLowerCase()}` : types.length > 2 ? "Properties" : p.category === "land" ? "Land" : p.category === "commercial" ? "Commercial property" : "Properties";
  const beds = p.bedroomsMin ? `${p.bedroomsMin}+ bedroom ` : "";
  const mode = p.listingType === "rent" ? " to rent" : p.listingType === "sale" ? " for sale" : p.listingType === "short_stay" ? " for short stay" : "";
  const radius = p.circle ? (p.circle.radiusM < 1000 ? `${p.circle.radiusM} m` : `${p.circle.radiusM / 1000} km`) : "";
  const place = p.circle ? ` within ${radius} of your pin` : p.polygon ? " in the area you drew" : county ? ` in ${county}` : p.q ? "" : " in Kenya";
  const kw = p.q ? keyWords(p.q) : "";
  const near = kw ? ` matching “${kw}”` : "";
  const lead = beds ? beds + what.charAt(0).toLowerCase() + what.slice(1) : what;
  const title = `${lead}${mode}${place}${near}`;
  const money = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
  const price = p.priceMin && p.priceMax ? `${money(p.priceMin)} to ${money(p.priceMax)}` : p.priceMax ? `up to ${money(p.priceMax)}` : p.priceMin ? `from ${money(p.priceMin)}` : "";
  const filtered = !!(p.circle || p.polygon || county || p.q || types.length || p.bedroomsMin || price || p.features?.length || p.furnishing || p.verifiedOnly);
  const subtitle = filtered ? ["Matching your search", price, p.furnishing ? p.furnishing.replace("_", "-") : "", p.verifiedOnly ? "verified agencies only" : ""].filter(Boolean).join(", ") + "." : "Homes, land and commercial property from verified agents and owners.";
  return { title, subtitle };
}
