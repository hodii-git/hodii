/** Plain JSON, so server functions can send it to the browser. */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
export type JsonObject = { [k: string]: Json };
import type { ListingType, PropertyCategory } from "./mongodb/taxonomy";

/** What the pages receive. Never contains private fields (creator, moderation, source, hidden addresses, phone numbers). */
export type PriceDto = { amount: number; currency: string; period: string; negotiable: boolean };
export type ImageDto = { url: string; thumbUrl: string | null; alt: string; width: number; height: number; caption: string | null };
export type AgencyBadge = { slug: string; name: string; logo: string | null; verified: boolean; kind: string; rating: { count: number; avg: number } | null };

export type PropertyCard = {
  id: string; slug: string; referenceCode: string; title: string;
  listingType: ListingType; category: PropertyCategory; propertyType: string;
  price: PriceDto | null; county: string | null; areaName: string;
  bedrooms: number | null; bathrooms: number | null; parking: number | null; sizeSqm: number | null;
  image: ImageDto | null; /** Next photos after the cover (up to 4), for the dots on a card. */ more: ImageDto[]; imageCount: number;
  verified: boolean; tier: "none" | "boost" | "premium"; priceDrop: boolean; publishedAt: string | null;
  agency: AgencyBadge | null;
};

export type PropertyDetail = PropertyCard & {
  description: string; highlights: string[]; features: string[]; customFeatures: string[]; nearby: { category: string; name: string; distanceM: number | null }[];
  images: ImageDto[]; floorPlans: ImageDto[]; videoUrl: string | null; virtualTourUrl: string | null;
  location: { county: string | null; countySlug: string | null; areaName: string; areaSlug: string | null; address: string | null; landmark: string | null; point: { lat: number; lng: number } | null; approximate: boolean };
  details: JsonObject; legal: JsonObject;
  rental: JsonObject | null; shortStay: JsonObject | null; sale: JsonObject | null;
  expiresAt: string | null; stats: { views: number; saves: number };
  agencyProfile: { slug: string; name: string; description: string; logo: string | null; verified: boolean; kind: string; website: string | null; area: string | null } | null;
  agent: { name: string; title: string | null; photoUrl: string | null } | null;
  contact: { hasPhone: boolean; hasWhatsapp: boolean };
};

export type SearchResult = { items: PropertyCard[]; total: number; page: number; pageSize: number; unavailable: boolean; /** True when nothing matched the words exactly and close spellings were used instead. */ fuzzy?: boolean; /** Set when nothing matched exactly and the search was loosened; says what was loosened, e.g. "one fewer bedroom". */ nearest?: string[] };

/** A price drop counts for two weeks. `priceHistory` holds the previous prices, each stamped with when it was replaced. */
export function isPriceDrop(current: number | null, history: readonly { amount: number; changedAt: Date | string }[] | undefined, now = Date.now()) {
  const last = history?.[history.length - 1];
  if (!current || !last) return false;
  return last.amount > current && now - new Date(last.changedAt).getTime() < 14 * 86_400_000;
}
