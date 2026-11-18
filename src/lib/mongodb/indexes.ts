export type CollectionIndex = {
  key: Record<string, 1 | -1 | "text" | "2dsphere">;
  name: string;
  unique?: boolean;
  expireAfterSeconds?: number;
  /** Index only documents matching this filter (used to make "unique when present" indexes). */
  partialFilterExpression?: Record<string, unknown>;
  weights?: Record<string, number>;
  collation?: { locale: string; strength: number };
  default_language?: string;
};
const unique = (name: string, key: CollectionIndex["key"]): CollectionIndex => ({ name, key, unique: true });
const DAY = 86_400;
const stringPresent = (field: string) => ({ [field]: { $type: "string" } });

/** The property marketplace's collections. Every query the site and dashboards make is covered by one of these. */
export const propertyCollectionIndexes: Record<string, CollectionIndex[]> = {
  users: [unique("email_unique", { emailHash: 1 }),
    // Usernames are unique ignoring case.
    { name: "username_unique", key: { username: 1 }, unique: true, collation: { locale: "en", strength: 2 } }, { name: "account_type", key: { accountType: 1, createdAt: -1 } }],
  agencies: [
    unique("agency_slug", { slug: 1 }),
    { name: "agency_directory", key: { status: 1, "verification.status": 1, kind: 1, name: 1 } },
    { name: "agency_by_creator", key: { createdBy: 1 } },
    { name: "agency_verification_queue", key: { "verification.status": 1, "verification.submittedAt": 1 } },
  ],
  agencyMembers: [
    { name: "one_membership", key: { agencyId: 1, userId: 1 }, unique: true, partialFilterExpression: stringPresent("userId") },
    { name: "invite_token", key: { "invite.tokenHash": 1 }, unique: true, partialFilterExpression: stringPresent("invite.tokenHash") },
    { name: "memberships_of_user", key: { userId: 1, status: 1 } },
    { name: "team", key: { agencyId: 1, status: 1, role: 1 } },
  ],
  properties: [
    unique("property_slug", { slug: 1 }),
    unique("property_reference", { referenceCode: 1 }),
    // Scrapers and imports can be re-run without creating duplicates.
    { name: "source_dedupe", key: { "source.kind": 1, "source.externalId": 1 }, unique: true, partialFilterExpression: stringPresent("source.externalId") },
    // Agency and agent dashboards.
    { name: "agency_listings", key: { agencyId: 1, status: 1, updatedAt: -1 } },
    { name: "agent_listings", key: { agentId: 1, status: 1, updatedAt: -1 } },
    // Public search and category pages.
    { name: "search_county", key: { status: 1, listingType: 1, category: 1, "location.countyCode": 1, "price.amountKes": 1 } },
    { name: "search_type", key: { status: 1, listingType: 1, propertyType: 1, "location.countyCode": 1, publishedAt: -1 } },
    { name: "search_area", key: { status: 1, "location.countySlug": 1, "location.areaSlug": 1, listingType: 1, publishedAt: -1 } },
    { name: "newest", key: { status: 1, publishedAt: -1 } },
    { name: "promoted", key: { status: 1, "promotion.tier": 1, "promotion.until": 1, publishedAt: -1 } },
    { name: "promo_ends", key: { "promotion.until": 1 }, partialFilterExpression: { "promotion.until": { $type: "date" } } },
    { name: "geo", key: { "location.point": "2dsphere" } },
    { name: "recently_changed", key: { status: 1, updatedAt: -1 } },
    { name: "listing_text", key: { title: "text", "location.areaName": "text", description: "text" }, weights: { title: 10, "location.areaName": 5, description: 1 }, default_language: "none" },
    // Background jobs and moderation.
    { name: "expiry_sweep", key: { status: 1, expiresAt: 1 } },
    { name: "moderation_queue", key: { status: 1, updatedAt: 1 } },
  ],
  developments: [
    unique("development_slug", { slug: 1 }),
    { name: "agency_developments", key: { agencyId: 1, publishStatus: 1, updatedAt: -1 } },
    { name: "public_developments", key: { publishStatus: 1, "location.countyCode": 1, publishedAt: -1 } },
    { name: "development_geo", key: { "location.point": "2dsphere" } },
  ],
  areas: [
    { name: "area_in_county", key: { countyCode: 1, slug: 1 }, unique: true },
    { name: "area_slug", key: { slug: 1 } },
  ],
  enquiries: [
    { name: "agency_leads", key: { agencyId: 1, status: 1, createdAt: -1 } },
    { name: "property_leads", key: { propertyId: 1, createdAt: -1 } },
    { name: "agent_leads", key: { agentId: 1, status: 1, createdAt: -1 } },
    { name: "my_enquiries", key: { userId: 1, createdAt: -1 } },
    { name: "enquiry_rate_limit", key: { ipHash: 1, createdAt: -1 } },
    // Privacy policy: enquiries are kept for 24 months.
    { name: "enquiry_retention", key: { createdAt: 1 }, expireAfterSeconds: 730 * DAY },
  ],
  notifications: [
    { name: "my_notifications", key: { userId: 1, createdAt: -1 } },
    { name: "my_unread", key: { userId: 1, readAt: 1 } },
    { name: "no_repeats", key: { userId: 1, dedupeKey: 1 }, unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } },
    { name: "notification_retention", key: { createdAt: 1 }, expireAfterSeconds: 90 * DAY },
  ],
  aiUsage: [
    { name: "usage_retention", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  searchTerms: [
    { name: "by_day", key: { day: -1, searches: -1 } },
    { name: "by_day_zero", key: { day: -1, zero: -1 } },
    { name: "term_retention", key: { updatedAt: 1 }, expireAfterSeconds: 120 * DAY },
  ],
  tourProgress: [
    { name: "person_tour", key: { userId: 1, tour: 1 }, unique: true },
  ],
  neighbourhoodReviews: [
    { name: "one_per_person_per_area", key: { areaKey: 1, userId: 1 }, unique: true },
    { name: "by_user", key: { userId: 1, updatedAt: -1 } },
  ],
  neighbourhoodPosts: [
    { name: "by_area_time", key: { areaKey: 1, createdAt: 1 } },
    { name: "by_user_time", key: { userId: 1, createdAt: -1 } },
  ],
  feedback: [
    { name: "by_status_time", key: { status: 1, createdAt: -1 } },
    { name: "by_kind_time", key: { kind: 1, createdAt: -1 } },
    { name: "by_ip_time", key: { ipHash: 1, createdAt: -1 } },
  ],
  errorEvents: [
    { name: "by_fingerprint", key: { fingerprint: 1 }, unique: true },
    { name: "recent", key: { lastSeen: -1 } },
    { name: "error_retention", key: { lastSeen: 1 }, expireAfterSeconds: 60 * DAY },
  ],
  enquiryMessages: [
    { name: "thread", key: { enquiryId: 1, createdAt: 1 } },
    { name: "sender_rate", key: { senderUserId: 1, createdAt: -1 } },
  ],
  agencyReviews: [
    { name: "one_per_user", key: { agencyId: 1, userId: 1 }, unique: true },
    { name: "by_agency", key: { agencyId: 1, status: 1, createdAt: -1 } },
    { name: "reported", key: { status: 1, updatedAt: -1 }, partialFilterExpression: { "reportedBy.0": { $exists: true } } },
  ],
  payments: [
    { name: "by_checkout", key: { checkoutRequestId: 1 }, unique: true, partialFilterExpression: { checkoutRequestId: { $type: "string" } } },
    { name: "by_agency", key: { agencyId: 1, createdAt: -1 } },
    { name: "by_property", key: { propertyId: 1, createdAt: -1 } },
    { name: "by_receipt", key: { receipt: 1 }, unique: true, partialFilterExpression: { receipt: { $type: "string" } } },
    { name: "by_kind", key: { kind: 1, status: 1, createdAt: -1 } },
  ],
  spacePacks: [
    { name: "by_agency_end", key: { agencyId: 1, endsAt: -1 } },
  ],
  premiumPackages: [
    { name: "by_agency", key: { agencyId: 1, endsAt: -1 } },
    { name: "ending", key: { endsAt: 1 } },
    { name: "by_listing", key: { listingIds: 1 } },
  ],
  propertyComments: [
    { name: "thread", key: { propertyId: 1, createdAt: 1 } },
    { name: "my_comments", key: { userId: 1, createdAt: -1 } },
    { name: "latest", key: { createdAt: -1 } },
  ],
  propertyCommentLikes: [
    { name: "one_like", key: { userId: 1, commentId: 1 }, unique: true },
    { name: "likes_of_comment", key: { commentId: 1 } },
    { name: "likes_received", key: { authorId: 1 } },
  ],
  savedProperties: [
    { name: "one_save", key: { userId: 1, propertyId: 1 }, unique: true },
    { name: "my_saved", key: { userId: 1, createdAt: -1 } },
    { name: "saves_of_property", key: { propertyId: 1 } },
  ],
  savedSearches: [{ name: "my_searches", key: { userId: 1, createdAt: -1 } }, { name: "alert_queue", key: { frequency: 1, lastNotifiedAt: 1 } }],
  listingReports: [{ name: "report_queue", key: { status: 1, createdAt: -1 } }, { name: "report_rate_limit", key: { reporterIpHash: 1, createdAt: -1 } }, { name: "reports_of_property", key: { propertyId: 1, createdAt: -1 } }],
  propertyEvents: [
    { name: "events_of_property", key: { propertyId: 1, kind: 1, occurredAt: -1 } },
    { name: "events_of_agency", key: { agencyId: 1, occurredAt: -1 } },
    { name: "reveals_by_visitor", key: { visitorHash: 1, kind: 1, occurredAt: -1 } },
    { name: "reveals_by_network", key: { ipHash: 1, occurredAt: -1 }, partialFilterExpression: { ipHash: { $type: "string" } } },
    // Privacy policy: usage data is kept for 24 months.
    { name: "event_retention", key: { occurredAt: 1 }, expireAfterSeconds: 730 * DAY },
  ],
  propertyDailyStats: [
    { name: "one_day_per_property", key: { propertyId: 1, date: 1 }, unique: true },
    { name: "agency_by_day", key: { agencyId: 1, date: -1 } },
    { name: "market_by_day", key: { date: -1, countyCode: 1, listingType: 1 } },
  ],
};
