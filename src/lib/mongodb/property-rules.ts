import { LISTING_LIMITS } from "./limits";
import { toSlug } from "./kenya";
import {
  CLOSED_REASONS, FEATURES, PERIODS_FOR, ROOM_TYPES, SHORT_STAY_TYPES, propertyTypeInfo,
  type ListingStatus, type ListingType, type PropertyCategory,
} from "./taxonomy";

/**
 * Business rules for a listing, kept free of Zod and the database so forms, server functions and tests share them.
 * `consistencyIssues` must hold for every saved listing, drafts included.
 * `publishIssues` must also hold before a listing can leave draft: this is what "complete" means.
 */
export type Issue = { path: string; message: string };

export type ListingLike = {
  status: ListingStatus;
  closedReason?: string | null;
  listingType: ListingType;
  category: PropertyCategory;
  propertyType: string;
  title: string;
  description: string;
  price: { amount: number; currency: string; period: string } | null;
  location: { countyCode: number | null; areaName: string };
  details: {
    bedrooms: number | null; bathrooms: number | null; ensuiteBedrooms: number | null;
    plotAreaSqm: number | null; floorAreaSqm: number | null; floorLevel: number | null; totalFloors: number | null;
  };
  features: readonly string[];
  images: readonly unknown[];
};

export function consistencyIssues(p: ListingLike): Issue[] {
  const out: Issue[] = [];
  const add = (path: string, message: string) => out.push({ path, message });
  const info = propertyTypeInfo(p.propertyType);
  if (!info) add("propertyType", "Choose a property type");
  else if (info.category !== p.category) add("propertyType", `${info.label} is not a ${p.category} property type`);

  if (p.listingType === "short_stay" && !SHORT_STAY_TYPES.includes(p.propertyType as never)) {
    add("listingType", "Only places people can stay in can be listed as a short stay");
  }
  if (p.price && !(PERIODS_FOR[p.listingType] as readonly string[]).includes(p.price.period)) {
    add("price.period", `A ${p.listingType.replace("_", " ")} listing must be priced ${PERIODS_FOR[p.listingType].join(" or ")}`);
  }
  if (p.price && (p.price.amount < LISTING_LIMITS.priceMin || p.price.amount > LISTING_LIMITS.priceMax)) {
    add("price.amount", "Enter a price within the allowed range");
  }
  if (p.category === "land") {
    if (p.details.bedrooms !== null || p.details.bathrooms !== null) add("details", "Land cannot have bedrooms or bathrooms");
    if (p.details.floorLevel !== null || p.details.totalFloors !== null) add("details", "Land cannot have floors");
  }
  if (p.details.bedrooms !== null && p.details.ensuiteBedrooms !== null && p.details.ensuiteBedrooms > p.details.bedrooms) {
    add("details.ensuiteBedrooms", "En-suite bedrooms cannot exceed the number of bedrooms");
  }
  if (p.details.floorLevel !== null && p.details.totalFloors !== null && p.details.floorLevel > p.details.totalFloors) {
    add("details.floorLevel", "The floor level cannot be above the number of floors");
  }
  const allowed = new Set<string>(FEATURES.filter((f) => (f.for as readonly string[]).includes(p.category)).map((f) => f.key));
  const seen = new Set<string>();
  for (const f of p.features) {
    if (!FEATURES.some((x) => x.key === f)) add("features", `Unknown feature “${f}”`);
    else if (!allowed.has(f)) add("features", `“${f}” does not apply to ${p.category} listings`);
    if (seen.has(f)) add("features", `Feature “${f}” is listed twice`);
    seen.add(f);
  }
  if (p.status === "closed" && !(CLOSED_REASONS as readonly string[]).includes(p.closedReason ?? "")) {
    add("closedReason", "Say whether the property was sold, let or withdrawn");
  }
  if (p.status !== "closed" && p.closedReason) add("closedReason", "Only closed listings have a closed reason");
  return out;
}

/** What is still missing before this listing can be published. Empty means it is complete. */
export function publishIssues(p: ListingLike): Issue[] {
  const out: Issue[] = [];
  const add = (path: string, message: string) => out.push({ path, message });
  const title = p.title.trim().length;
  if (title < LISTING_LIMITS.titleMin) add("title", `The title needs at least ${LISTING_LIMITS.titleMin} characters`);
  if (title > LISTING_LIMITS.titleMax) add("title", `The title can be at most ${LISTING_LIMITS.titleMax} characters`);
  const desc = p.description.trim().length;
  if (desc < LISTING_LIMITS.descriptionMin) add("description", `Describe the property in at least ${LISTING_LIMITS.descriptionMin} characters`);
  if (desc > LISTING_LIMITS.descriptionMax) add("description", `The description can be at most ${LISTING_LIMITS.descriptionMax} characters`);
  if (p.images.length < LISTING_LIMITS.imagesMin) add("images", "Add at least one photo of the property");
  if (p.images.length > LISTING_LIMITS.imagesMax) add("images", `Use at most ${LISTING_LIMITS.imagesMax} photos`);
  if (!p.price) add("price", "Set a price");
  if (p.location.countyCode === null) add("location.county", "Choose the county");
  if (p.location.areaName.trim().length < LISTING_LIMITS.areaNameMin) add("location.area", "Enter the area or neighbourhood");
  if ((ROOM_TYPES as readonly string[]).includes(p.propertyType)) {
    if (p.details.bedrooms === null) add("details.bedrooms", "Enter the number of bedrooms (0 for a bedsitter or studio)");
    if (p.details.bathrooms === null) add("details.bathrooms", "Enter the number of bathrooms");
  }
  if (p.category === "land" && !p.details.plotAreaSqm) add("details.plotArea", "Enter the size of the land");
  if (p.category === "commercial" && !p.details.floorAreaSqm && !p.details.plotAreaSqm) add("details.floorArea", "Enter the floor or plot area");
  return out;
}

/** Slug segments shown in listing URLs, e.g. "3-bedroom-apartment-to-rent-kilimani-nairobi-hd-7k3m2q". */
export function buildListingSlug(input: {
  listingType: ListingType; propertyType: string; bedrooms: number | null; areaSlug: string; countySlug: string; referenceCode: string;
}) {
  const ref = input.referenceCode.toLowerCase();
  const room = input.bedrooms && input.bedrooms > 0 && !["bedsitter", "studio"].includes(input.propertyType) ? `${input.bedrooms}-bedroom` : "";
  const forWhat = input.listingType === "sale" ? "for-sale" : input.listingType === "rent" ? "to-rent" : "short-stay";
  const where = input.areaSlug === input.countySlug ? input.areaSlug : `${input.areaSlug}-${input.countySlug}`;
  const head = [room, toSlug(input.propertyType), forWhat, where].filter(Boolean).join("-");
  const room4ref = LISTING_LIMITS.slugMax - ref.length - 1;
  const trimmed = head.length > room4ref ? head.slice(0, room4ref).replace(/-[^-]*$/, "") || head.slice(0, room4ref) : head;
  return `${trimmed.replace(/-+$/, "")}-${ref}`;
}

/** Public reference such as HD-7K3M2Q. The alphabet drops look-alike characters (0/O, 1/I/L) so it can be read out over the phone. */
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function generateReferenceCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = random(6);
  return `HD-${Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("")}`;
}
export const REFERENCE_CODE = /^HD-[2-9A-HJKMNP-Z]{6}$/;

/** When a listing published at `from` must be re-confirmed. */
export const listingExpiry = (from: Date) => new Date(from.getTime() + LISTING_LIMITS.listingLifetimeDays * 86_400_000);

/** Year-built upper bound at a given moment (allows off-plan completions a few years ahead). */
export const maxYearBuilt = (now = new Date()) => now.getUTCFullYear() + LISTING_LIMITS.yearBuiltAheadYears;
