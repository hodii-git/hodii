import { COUNTY_LIST } from "./mongodb/kenya";
import { FEATURES, PROPERTY_TYPES, type ListingType } from "./mongodb/taxonomy";
import type { SearchParams } from "./listing-search";

/**
 * Reads a typed search such as "2 bedroom apartment in kilimani under 80k to rent" and turns the parts it is sure about into filters.
 * Whatever is left over ("kilimani") stays as the keyword search. Pure and free: no AI is involved, so it works for everyone, always.
 */
export type Criteria = Partial<Pick<SearchParams, "q" | "listingType" | "propertyTypes" | "countyCodes" | "priceMin" | "priceMax" | "bedroomsMin" | "bathroomsMin" | "features" | "furnishing" | "verifiedOnly">>;
export type Understood = { criteria: Criteria; /** Short plain phrases for what was understood, for display. */ notes: string[] };

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const NUM = "(\\d{1,3}(?:[, ]\\d{3})+|\\d+(?:\\.\\d+)?)\\s*(k|m|mil|million|thousand)?";
const STOP = new Set(["said","told","meant","mean","wanted","searching","search","bed","beds","bedroom","bedrooms","bath","baths","bathroom","bathrooms","br","bd","bdrm","am","im","would","like","could","should","will","get","give","where","what","which","there","their","its","not","no","yes","ok","okay","hi","hello","hey","um","uh","also","too","one","a", "an", "the", "in", "at", "for", "to", "with", "near", "around", "and", "of", "me", "i", "want", "looking", "find", "show", "need", "please", "some", "any", "kes", "ksh", "kshs", "on", "my", "is", "are", "that", "has", "have", "under", "over", "make", "it", "change", "set", "add", "now", "instead", "also", "lets", "let", "us", "just", "only", "but", "then", "so", "go", "do", "can", "you", "try", "again", "car", "cars", "full", "fully", "very", "big", "nice", "good", "great", "beautiful", "spacious", "cheap", "affordable", "place", "places", "property", "properties", "home", "homes", "listing", "listings", "something", "somewhere", "located", "preferably", "ideally", "about", "approximately", "roughly", "per", "month", "monthly", "ten", "two", "three", "four", "five", "six", "seven", "eight", "nine", "area", "side", "estate"]);

export const parseMoney = (num: string, unit?: string): number => {
  const n = Number(num.replace(/[, ]/g, ""));
  const u = (unit ?? "").toLowerCase();
  const mult = u === "k" || u === "thousand" ? 1_000 : u === "m" || u === "mil" || u === "million" ? 1_000_000 : 1;
  return Math.round(n * mult);
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Longest phrase first, so "semi furnished" is not read as "furnished". */
const byLength = <T extends { words: string[] }>(xs: T[]) => [...xs].sort((a, b) => Math.max(...b.words.map((w) => w.length)) - Math.max(...a.words.map((w) => w.length)));

export function understand(text: string): { understood: Understood; leftover: string } {
  let s = ` ${text.toLowerCase().replace(/[“”"']/g, " ").replace(/\s+/g, " ")} `;
  const c: Criteria = {};
  const notes: string[] = [];
  const take = (rx: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(rx);
    if (!m) return false;
    fn(m);
    s = s.replace(rx, " ");
    return true;
  };
  const money = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

  // Price: ranges first, then one-sided. A range only counts when it is money, so "2-3 bedrooms" is left alone.
  const range = (rx: RegExp) => {
    const m = s.match(rx);
    if (!m) return false;
    const a = parseMoney(m[1]!, m[2] ?? m[4]), b = parseMoney(m[3]!, m[4]);
    if (Math.max(a, b) < 1000) return false;
    c.priceMin = Math.min(a, b); c.priceMax = Math.max(a, b); notes.push(`${money(c.priceMin)} to ${money(c.priceMax)}`);
    s = s.replace(rx, " ");
    return true;
  };
  if (!range(new RegExp(`(?:between|from)\\s+(?:kes\\s*|ksh\\s*)?${NUM}\\s*(?:and|to|-)\\s*(?:kes\\s*|ksh\\s*)?${NUM}`))) {
    range(new RegExp(`\\b(?:kes\\s*|ksh\\s*)?${NUM}\\s*(?:-|to)\\s*(?:kes\\s*|ksh\\s*)?${NUM}(?!\\s*(?:bed|br|bath))`));
  }
  if (c.priceMax === undefined) {
    take(new RegExp(`\\b(?:under|below|less than|up to|upto|max(?:imum)?|not more than|within|budget(?: of)?|cheaper than)\\s*(?:kes\\s*|ksh\\s*|kshs\\s*)?${NUM}`), (m) => {
      const v = parseMoney(m[1]!, m[2]); if (v >= 1000) { c.priceMax = v; notes.push(`Up to ${money(v)}`); }
    });
  }
  if (c.priceMin === undefined) {
    take(new RegExp(`\\b(?:over|above|more than|from|at least|min(?:imum)?|starting at)\\s*(?:kes\\s*|ksh\\s*|kshs\\s*)?${NUM}(?!\\s*(?:bed|br|bath))`), (m) => {
      const v = parseMoney(m[1]!, m[2]); if (v >= 1000) { c.priceMin = v; notes.push(`From ${money(v)}`); }
    });
  }

  // Bedrooms and bathrooms: "3 bedroom", "3br", "three beds"; also "bedsitter" is a property type, handled below.
  take(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:-|\s)?(?:bedrooms?|bdrm|beds?|br|bd)\b/, (m) => {
    const n = WORD_NUMBERS[m[1]!] ?? Number(m[1]); if (n >= 0 && n <= 20) { c.bedroomsMin = n; notes.push(`${n}+ bedrooms`); }
  });
  take(/\b(\d{1,2}|one|two|three|four|five|six)\s*(?:-|\s)?(?:bathrooms?|baths?|washrooms?)\b/, (m) => {
    const n = WORD_NUMBERS[m[1]!] ?? Number(m[1]); if (n >= 0 && n <= 20) { c.bathroomsMin = n; notes.push(`${n}+ bathrooms`); }
  });

  // Rent, buy or short stay.
  const type: ListingType | null =
    /\b(short[- ]?stay|airbnb|per night|nightly|holiday (?:home|rental)|vacation rental)\b/.test(s) ? "short_stay"
    : /\b(to rent|for rent|rent|rental|renting|to let|tolet|lease)\b/.test(s) ? "rent"
    : /\b(for sale|to buy|buy|buying|sale|purchase|selling)\b/.test(s) ? "sale" : null;
  if (type) {
    c.listingType = type;
    s = s.replace(/\b(short[- ]?stay|airbnb|per night|nightly|holiday (?:home|rental)|vacation rental|to rent|for rent|renting|rental|rent|to let|tolet|lease|for sale|to buy|buying|buy|sale|purchase|selling)\b/g, " ");
    notes.push(type === "rent" ? "To rent" : type === "sale" ? "For sale" : "Short stay");
  }

  // Furnishing (longest first).
  if (take(/\bsemi[- ]?furnished\b/, () => { c.furnishing = "semi_furnished"; notes.push("Semi-furnished"); })) { /* done */ }
  else if (take(/\bunfurnished\b/, () => { c.furnishing = "unfurnished"; notes.push("Unfurnished"); })) { /* done */ }
  else take(/\b(?:fully |well |nicely )?furnished\b/, () => { c.furnishing = "furnished"; notes.push("Furnished"); });

  take(/\bverified\b/, () => { c.verifiedOnly = true; notes.push("Verified only"); });

  // Property types: label or plural, longest first. "flat" is what many people call an apartment.
  const types = byLength(PROPERTY_TYPES.map((t) => ({ key: t.key, label: t.label, words: [t.label.toLowerCase(), t.plural.toLowerCase(), ...(t.key === "apartment" ? ["flat", "flats"] : t.key === "bedsitter" ? ["bedsit", "bed sitter"] : [])] })));
  const typeKeys: string[] = [];
  for (const t of types) {
    for (const w of [...t.words].sort((a, b) => b.length - a.length)) {
      const rx = new RegExp(`\\b${escape(w)}\\b`);
      if (rx.test(s)) { if (!typeKeys.includes(t.key)) typeKeys.push(t.key); s = s.replace(new RegExp(`\\b${escape(w)}\\b`, "g"), " "); }
    }
  }
  if (typeKeys.length) { c.propertyTypes = typeKeys.slice(0, 10) as NonNullable<Criteria["propertyTypes"]>; notes.push(typeKeys.map((k) => PROPERTY_TYPES.find((t) => t.key === k)!.label).join(" or ")); }

  // Counties by name. Longest names first ("Trans Nzoia", "Taita Taveta").
  const counties = [...COUNTY_LIST].sort((a, b) => b.name.length - a.name.length);
  const found: number[] = [];
  for (const k of counties) {
    const rx = new RegExp(`\\b${escape(k.name.toLowerCase())}(?: county)?\\b`);
    if (rx.test(s)) { found.push(k.code); s = s.replace(rx, " "); }
  }
  if (found.length) { c.countyCodes = found.slice(0, 10); notes.push(found.map((n) => COUNTY_LIST.find((k) => k.code === n)!.name).join(" or ")); }

  // Features named in the text, by label or by what people actually say ("ensuite", "master en-suite", "full ensuite").
  const feats: string[] = [];
  const SAID: Record<string, string[]> = { en_suite: ["(?:full |master |all )?en[- ]?suite(?: bedrooms?| rooms?)?", "(?:own|private) bathroom"], parking: ["(?:parking|garage|car park)(?: (?:space|slot)s?)?(?: for (?:\\d+|one|two|three|four|five|six) cars?)?", "(?:\\d+|one|two|three|four|five|six) car (?:parking|garage|park)"], borehole: ["own water", "borehole water"], security: ["(?:24 ?/ ?7|24 hour|round the clock) security", "secure"] };
  for (const f of [...FEATURES].sort((a, b) => b.label.length - a.label.length)) {
    const label = f.label.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    if (label.length < 3) continue;
    const rx = new RegExp(`\\b(?:${[escape(label), ...(SAID[f.key] ?? [])].join("|")})\\b`);
    if (rx.test(s)) { feats.push(f.key); s = s.replace(rx, " "); }
  }
  if (feats.length) { c.features = feats.slice(0, 10) as NonNullable<Criteria["features"]>; notes.push(feats.map((k) => FEATURES.find((f) => f.key === k)!.label).join(", ")); }

  // No word said rent or buy: a price like 4k or 80k can only be a monthly rent, and millions can only be a purchase.
  if (!c.listingType && c.priceMax !== undefined && c.priceMax >= 1000) {
    if (c.priceMax <= 600_000) { c.listingType = "rent"; notes.push("To rent (that price reads as monthly rent)"); }
    else if (c.priceMax >= 1_500_000) { c.listingType = "sale"; notes.push("For sale (that price reads as a purchase)"); }
  }

  const tokens = (x: string) => x.split(/[\s,.;:!?()]+/).map((q) => q.trim()).filter((q) => q.length > 2 && !STOP.has(q) && !/^\d+$/.test(q));
  const rest = tokens(s);
  // The place is what follows "in", "at", "near"... so "kilimanjaro, the balcony and parking for four cars" keeps only "kilimanjaro".
  const after = ` ${text.toLowerCase().replace(/[“”"']/g, " ")} `.match(/\b(?:in|at|near|around|off|along|within|kwa)\s+([a-z][a-z -]{2,40}?)(?=\s+(?:with|and|under|below|over|above|for|that|which|having|has|the|a|an|to|rent|sale|furnished|fully|full)\b|[,.;:!?]|\s*$)/);
  const near = after ? tokens(after[1]!).filter((w) => rest.includes(w)) : [];
  const leftover = (near.length ? near : rest).join(" ");
  if (leftover) c.q = leftover.slice(0, 100);
  return { understood: { criteria: c, notes }, leftover };
}

/** Does the text look like a sentence worth interpreting, rather than a single place name? */
export const looksLikeRequest = (text: string) => text.trim().split(/\s+/).length >= 2;
