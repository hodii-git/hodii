import type { Db, Document, Filter } from "mongodb";
import { fillByLevels } from "./home-nearby.server";
import { liveFilter } from "./listing-search";
import { regionOfCounty } from "./mongodb/kenya";
import { CARD_PROJECTION, cardsFor } from "./properties.server";
import type { PropertyCard } from "./property-dto";

// Server-only: "you might also like" under a listing.

export const SIMILAR_COUNT = 8;
export const AGENCY_COUNT = 4;

/**
 * Listings close to the one being viewed, closest first: same kind of property in the same area and price range, then the same kind
 * in the county, then the same category in the county and region, then the same category anywhere. Within each step the nearest price comes first.
 */
export async function loadSimilar(db: Db, d: Document): Promise<{ similar: PropertyCard[]; moreFromAgency: PropertyCard[] }> {
  const col = db.collection("properties");
  const now = new Date();
  const loc = (d["location"] ?? {}) as Document;
  const price = Number((d["price"] as Document | undefined)?.["amountKes"] ?? 0);
  const base: Filter<Document> = { ...liveFilter(now), listingType: d["listingType"] };
  const band: Filter<Document> = price ? { "price.amountKes": { $gte: Math.round(price * 0.7), $lte: Math.round(price * 1.4) } } : {};
  const county = typeof loc["countyCode"] === "number" ? { "location.countyCode": loc["countyCode"] } : {};
  const region = typeof loc["countyCode"] === "number" ? regionOfCounty(loc["countyCode"]) : undefined;
  const kind = { propertyType: d["propertyType"] };
  const cat = { category: d["category"] };
  const tier = (label: string, filter: Filter<Document>) => ({ level: "area" as const, label, filter });
  const tiers = [
    ...(typeof loc["areaSlug"] === "string" ? [tier("same kind, same area, similar price", { ...kind, "location.areaSlug": loc["areaSlug"], ...band })] : []),
    tier("same kind, same county, similar price", { ...kind, ...county, ...band }),
    tier("same kind, same county", { ...kind, ...county }),
    tier("same category, same county", { ...cat, ...county }),
    ...(region ? [tier("same category, same region", { ...cat, "location.countyCode": { $in: [...region.counties] } })] : []),
    tier("same category", { ...cat }),
  ];
  const { items } = await fillByLevels<PropertyCard>(tiers, SIMILAR_COUNT, async (filter, exclude, limit) => {
    const docs = await col.aggregate([
      { $match: { ...base, ...filter, _id: { $nin: [String(d["_id"]), ...exclude] } } },
      { $addFields: { priceGap: { $abs: { $subtract: ["$price.amountKes", price] } } } },
      { $sort: { priceGap: 1, publishedAt: -1, _id: 1 } }, { $limit: limit }, { $project: { ...CARD_PROJECTION } },
    ]).toArray();
    return cardsFor(db, docs);
  });
  const taken = [String(d["_id"]), ...items.map((i) => i.id)];
  const more = await col.aggregate([
    { $match: { ...liveFilter(now), agencyId: d["agencyId"], _id: { $nin: taken } } },
    { $sort: { publishedAt: -1, _id: 1 } }, { $limit: AGENCY_COUNT }, { $project: { ...CARD_PROJECTION } },
  ]).toArray();
  return { similar: items, moreFromAgency: await cardsFor(db, more) };
}
