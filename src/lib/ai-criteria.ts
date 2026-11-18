import { searchParamsSchema } from "./mongodb/property-schemas";
import type { Criteria } from "./query-intent";

const KEYS = ["q", "listingType", "propertyTypes", "countyCodes", "priceMin", "priceMax", "bedroomsMin", "bathroomsMin", "features", "furnishing", "verifiedOnly"] as const;

/**
 * Takes whatever the AI returned and keeps only the filters that are valid, one at a time, so one wrong value never loses the rest.
 * The model can only ever produce filters from our own lists: nothing it writes reaches the database unchecked.
 */
export function cleanCriteria(raw: unknown): Criteria {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of KEYS) {
    const v = src[k];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    const r = searchParamsSchema.safeParse({ [k]: v });
    if (r.success && (r.data as Record<string, unknown>)[k] !== undefined) out[k] = (r.data as Record<string, unknown>)[k];
  }
  const c = out as Criteria;
  if (c.priceMin !== undefined && c.priceMax !== undefined && c.priceMin > c.priceMax) delete c.priceMin;
  return c;
}

/** What the person typed first and what the AI answered, kept short and only for follow-up messages in the same visit. */
export type Turn = { role: "user" | "assistant"; content: string };
