import { blankListingForm, composeListing, listingFormSchema, type ListingForm } from "./listing-compose";
import { COUNTY_LIST } from "./mongodb/kenya";
import { consistencyIssues } from "./mongodb/property-rules";
import { propertySchema } from "./mongodb/property-schemas";
import { AREA_UNITS, FEATURES, PROPERTY_TYPES, propertyTypeInfo, type ListingType } from "./mongodb/taxonomy";

/**
 * Turns rows from a CSV file into listing forms, and says exactly what is wrong with each row that cannot be imported.
 * Imported listings are saved as drafts: photos have to be uploaded from the device, so the agent adds them and publishes.
 * Pure, so it is tested without a database.
 */
export const MAX_IMPORT_ROWS = 200;

export const TEMPLATE_HEADERS = [
  "title", "description", "listing_type", "property_type", "price", "currency", "price_period", "negotiable", "county", "area", "address", "landmark",
  "latitude", "longitude", "hide_exact_location", "bedrooms", "bathrooms", "parking_spaces", "floor_area_sqm", "plot_area", "plot_area_unit", "features", "highlights", "external_ref", "contact_phone",
] as const;

export const TEMPLATE_EXAMPLE = [
  "Spacious 2 bedroom apartment in Kilimani", "Bright apartment with a balcony, backup water and 24-hour security. Ten minutes from Yaya Centre.", "rent", "apartment", "55000", "KES", "month", "no", "Nairobi", "Kilimani", "Argwings Kodhek Road", "Near Yaya Centre",
  "-1.2921", "36.7872", "no", "2", "2", "1", "95", "", "", "security_24h; parking; backup_generator", "Balcony; Close to schools", "FLAT-001", "",
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const YES = new Set(["yes", "y", "true", "1"]), NO = new Set(["no", "n", "false", "0", ""]);
const typeByName = new Map<string, string>(PROPERTY_TYPES.flatMap((t) => [[norm(t.key), t.key], [norm(t.label), t.key], [norm(t.plural), t.key]] as [string, string][]));
const featureByName = new Map<string, string>(FEATURES.flatMap((f) => [[norm(f.key), f.key], [norm(f.label), f.key]] as [string, string][]));
const countyByName = new Map<string, number>(COUNTY_LIST.flatMap((c) => [[norm(c.name), c.code], [String(c.code), c.code]] as [string, number][]));
const PERIODS: Record<string, string> = { total: "total", month: "month", monthly: "month", "per month": "month", year: "year", yearly: "year", week: "week", weekly: "week", night: "night", nightly: "night", "per night": "night" };
const DEFAULT_PERIOD: Record<ListingType, string> = { sale: "total", rent: "month", short_stay: "night" };

export type RowResult = { row: number; ok: boolean; title: string; errors: string[]; form: ListingForm | null };

function num(raw: string, label: string, errors: string[], opts: { int?: boolean; min?: number; max?: number } = {}): number | null {
  const s = raw.replace(/[,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) { errors.push(`${label} must be a number`); return null; }
  if (opts.int && !Number.isInteger(n)) { errors.push(`${label} must be a whole number`); return null; }
  if (opts.min !== undefined && n < opts.min) { errors.push(`${label} cannot be below ${opts.min}`); return null; }
  if (opts.max !== undefined && n > opts.max) { errors.push(`${label} cannot be above ${opts.max}`); return null; }
  return n;
}
const list = (s: string) => s.split(/[;|]/).map((x) => x.trim()).filter(Boolean);

/** Row 1 of the file is the header, so the first record is row 2. */
export function rowToForm(rec: Record<string, string>, rowNumber: number): RowResult {
  const g = (k: string) => (rec[k] ?? "").trim();
  const errors: string[] = [];
  const title = g("title");
  const f = blankListingForm();
  f.title = title; f.description = g("description");

  const lt = norm(g("listing_type")).replace(/^for /, "");
  const listingType = ({ sale: "sale", buy: "sale", rent: "rent", let: "rent", "short stay": "short_stay", short_stay: "short_stay", "short stay rental": "short_stay" } as Record<string, ListingType>)[lt] ?? ({ "short stay": "short_stay" } as Record<string, ListingType>)[lt];
  if (!listingType) errors.push("listing_type must be sale, rent or short_stay"); else f.listingType = listingType;

  const pt = typeByName.get(norm(g("property_type")));
  if (!pt) errors.push(`property_type "${g("property_type")}" is not one we know. Use a name like apartment, house, residential plot or office`); else f.propertyType = pt as ListingForm["propertyType"];

  const amount = num(g("price"), "price", errors, { int: true, min: 1 });
  if (amount === null && !errors.some((e) => e.startsWith("price"))) errors.push("price is required");
  const currency = (g("currency") || "KES").toUpperCase();
  if (currency !== "KES" && currency !== "USD") errors.push("currency must be KES or USD");
  const periodRaw = norm(g("price_period"));
  const period = periodRaw ? PERIODS[periodRaw] : listingType ? DEFAULT_PERIOD[listingType] : "total";
  if (!period) errors.push("price_period must be total, month, year, week or night");
  const neg = norm(g("negotiable"));
  if (!YES.has(neg) && !NO.has(neg)) errors.push("negotiable must be yes or no");
  if (amount !== null && period && (currency === "KES" || currency === "USD")) f.price = { amount, currency, period: period as never, negotiable: YES.has(neg) };

  const county = countyByName.get(norm(g("county")));
  if (!county) errors.push(`county "${g("county")}" was not found. Use the county's name, like Nairobi or Uasin Gishu`); else f.location.countyCode = county;
  f.location.areaName = g("area");
  if (!f.location.areaName) errors.push("area is required");
  f.location.address = g("address") || null; f.location.landmark = g("landmark") || null;
  const lat = num(g("latitude"), "latitude", errors, { min: -5, max: 5.5 }), lng = num(g("longitude"), "longitude", errors, { min: 33.5, max: 42 });
  if ((lat === null) !== (lng === null)) errors.push("give both latitude and longitude, or neither");
  else if (lat !== null && lng !== null) f.location.point = { lat, lng };
  const hide = norm(g("hide_exact_location")); if (!YES.has(hide) && !NO.has(hide)) errors.push("hide_exact_location must be yes or no"); f.location.hideExactLocation = YES.has(hide);

  f.details.bedrooms = num(g("bedrooms"), "bedrooms", errors, { int: true, min: 0, max: 50 });
  f.details.bathrooms = num(g("bathrooms"), "bathrooms", errors, { int: true, min: 0, max: 50 });
  f.details.parkingSpaces = num(g("parking_spaces"), "parking_spaces", errors, { int: true, min: 0, max: 100 });
  f.details.floorAreaSqm = num(g("floor_area_sqm"), "floor_area_sqm", errors, { min: 1 });
  const plot = num(g("plot_area"), "plot_area", errors, { min: 0 }); const unit = norm(g("plot_area_unit")) || (plot !== null ? "sqm" : "");
  if (plot !== null) { if (!(AREA_UNITS as readonly string[]).includes(unit)) errors.push("plot_area_unit must be sqm, sqft, acre or hectare"); else { f.details.plotAreaValue = plot; f.details.plotAreaUnit = unit as never; } }

  const feats: string[] = [];
  for (const raw of list(g("features"))) { const k = featureByName.get(norm(raw)); if (k) feats.push(k); else errors.push(`feature "${raw}" is not one we know`); }
  f.features = [...new Set(feats)] as ListingForm["features"];
  f.highlights = list(g("highlights")).slice(0, 8);
  f.externalRef = g("external_ref") || null;
  f.contactPhone = g("contact_phone") || null;

  const shape = listingFormSchema.safeParse(f);
  if (!shape.success) for (const i of shape.error.issues.slice(0, 3)) errors.push(`${i.path.join(".") || "row"}: ${i.message}`);
  else if (!errors.length) {
    // The same checks a saved draft goes through, run here without saving anything.
    const doc = composeListing({ form: shape.data, existing: null, agencyId: "preview", userId: "preview", now: new Date(), status: "draft", newId: "preview", referenceCode: "HD-PRVWAB" });
    for (const i of consistencyIssues(doc)) errors.push(i.message);
    if (!errors.length) { const p = propertySchema.safeParse(doc); if (!p.success) for (const i of p.error.issues.slice(0, 2)) errors.push(`${i.path.join(".")}: ${i.message}`); }
    if (!propertyTypeInfo(f.propertyType)) errors.push("property_type is not valid");
  }
  return { row: rowNumber, ok: errors.length === 0, title: title || "(no title)", errors, form: errors.length ? null : f };
}

export type ImportPlan = { headerProblems: string[]; rows: RowResult[]; tooMany: boolean };

export function planImport(headers: string[], records: Record<string, string>[]): ImportPlan {
  const missing = ["title", "listing_type", "property_type", "price", "county", "area"].filter((h) => !headers.includes(h));
  const unknown = headers.filter((h) => h && !(TEMPLATE_HEADERS as readonly string[]).includes(h));
  const headerProblems = [...(missing.length ? [`Missing columns: ${missing.join(", ")}. Download the template to see them all.`] : []), ...(unknown.length ? [`These columns were ignored: ${unknown.join(", ")}`] : [])];
  if (missing.length) return { headerProblems, rows: [], tooMany: false };
  const rows = records.slice(0, MAX_IMPORT_ROWS).map((r, i) => rowToForm(r, i + 2));
  return { headerProblems, rows, tooMany: records.length > MAX_IMPORT_ROWS };
}
