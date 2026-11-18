/**
 * The property taxonomy: listing types, categories, property types, features and the other pick-lists a listing uses.
 * Keys are stored in the database and in URLs, so never rename a key; change its label instead.
 */

export const LISTING_TYPES = [
  { key: "sale", label: "For sale", short: "Buy" },
  { key: "rent", label: "To rent", short: "Rent" },
  { key: "short_stay", label: "Short stay", short: "Short stay" },
] as const;
export type ListingType = (typeof LISTING_TYPES)[number]["key"];
export const LISTING_TYPE_KEYS = LISTING_TYPES.map((t) => t.key) as unknown as [ListingType, ...ListingType[]];

export const PROPERTY_CATEGORIES = [
  { key: "residential", label: "Residential" },
  { key: "commercial", label: "Commercial" },
  { key: "land", label: "Land" },
] as const;
export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number]["key"];
export const PROPERTY_CATEGORY_KEYS = PROPERTY_CATEGORIES.map((c) => c.key) as unknown as [PropertyCategory, ...PropertyCategory[]];

export const PROPERTY_TYPES = [
  // Residential
  { key: "apartment", label: "Apartment", plural: "Apartments", category: "residential" },
  { key: "house", label: "House", plural: "Houses", category: "residential" },
  { key: "maisonette", label: "Maisonette", plural: "Maisonettes", category: "residential" },
  { key: "bungalow", label: "Bungalow", plural: "Bungalows", category: "residential" },
  { key: "townhouse", label: "Townhouse", plural: "Townhouses", category: "residential" },
  { key: "villa", label: "Villa", plural: "Villas", category: "residential" },
  { key: "mansion", label: "Mansion", plural: "Mansions", category: "residential" },
  { key: "penthouse", label: "Penthouse", plural: "Penthouses", category: "residential" },
  { key: "cottage", label: "Cottage", plural: "Cottages", category: "residential" },
  { key: "bedsitter", label: "Bedsitter", plural: "Bedsitters", category: "residential" },
  { key: "studio", label: "Studio", plural: "Studios", category: "residential" },
  { key: "serviced_apartment", label: "Serviced apartment", plural: "Serviced apartments", category: "residential" },
  { key: "student_hostel", label: "Student hostel", plural: "Student hostels", category: "residential" },
  { key: "apartment_block", label: "Apartment block", plural: "Apartment blocks", category: "residential" },
  // Commercial
  { key: "office", label: "Office", plural: "Offices", category: "commercial" },
  { key: "shop", label: "Shop or retail space", plural: "Shops and retail", category: "commercial" },
  { key: "warehouse", label: "Warehouse or godown", plural: "Warehouses", category: "commercial" },
  { key: "commercial_building", label: "Commercial building", plural: "Commercial buildings", category: "commercial" },
  { key: "industrial", label: "Industrial property", plural: "Industrial properties", category: "commercial" },
  { key: "hotel_lodge", label: "Hotel, lodge or guesthouse", plural: "Hotels and lodges", category: "commercial" },
  { key: "other_commercial", label: "Other commercial", plural: "Other commercial", category: "commercial" },
  // Land
  { key: "residential_plot", label: "Residential plot", plural: "Residential plots", category: "land" },
  { key: "commercial_plot", label: "Commercial plot", plural: "Commercial plots", category: "land" },
  { key: "agricultural_land", label: "Agricultural land", plural: "Agricultural land", category: "land" },
  { key: "farm_ranch", label: "Farm or ranch", plural: "Farms and ranches", category: "land" },
  { key: "industrial_land", label: "Industrial land", plural: "Industrial land", category: "land" },
  { key: "other_land", label: "Other land", plural: "Other land", category: "land" },
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number]["key"];
export const PROPERTY_TYPE_KEYS = PROPERTY_TYPES.map((t) => t.key) as unknown as [PropertyType, ...PropertyType[]];
export const propertyTypeInfo = (key: string) => PROPERTY_TYPES.find((t) => t.key === key);
export const typesInCategory = (category: PropertyCategory) => PROPERTY_TYPES.filter((t) => t.category === category);
/** Short stays only make sense for places people can sleep in. */
export const SHORT_STAY_TYPES: readonly PropertyType[] = ["apartment", "house", "maisonette", "bungalow", "townhouse", "villa", "mansion", "penthouse", "cottage", "studio", "serviced_apartment", "hotel_lodge"];
/** Types listed with rooms; they must state bedrooms and bathrooms (bedsitters and studios may state 0 bedrooms). */
export const ROOM_TYPES: readonly PropertyType[] = ["apartment", "house", "maisonette", "bungalow", "townhouse", "villa", "mansion", "penthouse", "cottage", "bedsitter", "studio", "serviced_apartment"];

export const PRICE_PERIODS = ["total", "month", "year", "week", "night"] as const;
export type PricePeriod = (typeof PRICE_PERIODS)[number];
/** Which price periods are valid for each listing type. */
export const PERIODS_FOR: Record<ListingType, readonly PricePeriod[]> = {
  sale: ["total"],
  rent: ["month", "year"],
  short_stay: ["night", "week"],
};
export const CURRENCIES = ["KES", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CONDITIONS = [
  { key: "new", label: "Newly built" },
  { key: "good", label: "Good condition" },
  { key: "needs_renovation", label: "Needs renovation" },
  { key: "under_construction", label: "Under construction" },
  { key: "off_plan", label: "Off-plan" },
] as const;
export const CONDITION_KEYS = CONDITIONS.map((c) => c.key) as unknown as [(typeof CONDITIONS)[number]["key"], ...(typeof CONDITIONS)[number]["key"][]];

export const FURNISHINGS = [
  { key: "unfurnished", label: "Unfurnished" },
  { key: "semi_furnished", label: "Semi-furnished" },
  { key: "furnished", label: "Furnished" },
] as const;
export const FURNISHING_KEYS = FURNISHINGS.map((f) => f.key) as unknown as [(typeof FURNISHINGS)[number]["key"], ...(typeof FURNISHINGS)[number]["key"][]];

export const TITLE_TYPES = [
  { key: "freehold", label: "Freehold" },
  { key: "leasehold", label: "Leasehold" },
  { key: "sectional_title", label: "Sectional title" },
  { key: "other", label: "Other" },
] as const;
export const TITLE_TYPE_KEYS = TITLE_TYPES.map((t) => t.key) as unknown as [(typeof TITLE_TYPES)[number]["key"], ...(typeof TITLE_TYPES)[number]["key"][]];

export const AREA_UNITS = ["sqm", "sqft", "acre", "hectare"] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];
const SQM_PER: Record<AreaUnit, number> = { sqm: 1, sqft: 0.09290304, acre: 4046.8564224, hectare: 10_000 };
/** Converts an area in any supported unit to square metres, rounded to two decimals. Used for filtering and sorting. */
export const toSqm = (value: number, unit: AreaUnit) => Math.round(value * SQM_PER[unit] * 100) / 100;

export const LAND_ZONINGS = ["residential", "commercial", "agricultural", "industrial", "mixed_use"] as const;
export const UTILITIES = [
  { key: "water", label: "Water" },
  { key: "electricity", label: "Electricity" },
  { key: "internet", label: "Internet" },
  { key: "garbage", label: "Garbage collection" },
  { key: "security", label: "Security" },
] as const;
export const UTILITY_KEYS = UTILITIES.map((u) => u.key) as unknown as [(typeof UTILITIES)[number]["key"], ...(typeof UTILITIES)[number]["key"][]];
export const PAYMENT_PLANS = ["cash", "mortgage", "installments"] as const;

/** Features a lister can tick. `for` limits a feature to categories where it makes sense. */
/** Places of interest an agent can list near a property, each with its exact name and the distance. */
export const NEARBY_CATEGORIES = [
  { key: "school", label: "Schools", placeholder: "e.g. Nairobi West Primary School" },
  { key: "hospital", label: "Hospitals and clinics", placeholder: "e.g. Nairobi West Hospital" },
  { key: "shopping", label: "Shopping", placeholder: "e.g. Yaya Centre" },
  { key: "transport", label: "Transport", placeholder: "e.g. Bus stage, matatu stage or train station" },
  { key: "food", label: "Restaurants and cafes", placeholder: "e.g. Java House" },
  { key: "worship", label: "Places of worship", placeholder: "e.g. St Austin's Church" },
  { key: "recreation", label: "Parks and recreation", placeholder: "e.g. Uhuru Gardens" },
  { key: "other", label: "Other", placeholder: "e.g. Police station" },
] as const;
export const NEARBY_KEYS = NEARBY_CATEGORIES.map((c) => c.key) as unknown as readonly [typeof NEARBY_CATEGORIES[number]["key"], ...typeof NEARBY_CATEGORIES[number]["key"][]];

export const FEATURE_GROUPS = [
  { key: "security", label: "Security" },
  { key: "utilities", label: "Utilities and power" },
  { key: "interior", label: "Interior" },
  { key: "outdoor", label: "Outdoor" },
  { key: "building", label: "Building and access" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "commercial", label: "Commercial" },
  { key: "land", label: "Land and plot" },
] as const;
export type FeatureGroup = (typeof FEATURE_GROUPS)[number]["key"];

const RES: readonly PropertyCategory[] = ["residential"];
const RES_COM: readonly PropertyCategory[] = ["residential", "commercial"];
const ALL: readonly PropertyCategory[] = ["residential", "commercial", "land"];
const COM: readonly PropertyCategory[] = ["commercial"];
const LAND: readonly PropertyCategory[] = ["land"];

export const FEATURES = [
  { key: "gated_community", label: "Gated community", group: "security", for: ALL },
  { key: "security_24h", label: "24-hour security", group: "security", for: ALL },
  { key: "cctv", label: "CCTV", group: "security", for: ALL },
  { key: "electric_fence", label: "Electric fence", group: "security", for: ALL },
  { key: "alarm_system", label: "Alarm system", group: "security", for: RES_COM },
  { key: "perimeter_wall", label: "Perimeter wall", group: "security", for: ALL },
  { key: "intercom", label: "Intercom", group: "security", for: RES_COM },
  { key: "borehole", label: "Borehole", group: "utilities", for: ALL },
  { key: "piped_water", label: "Piped water", group: "utilities", for: ALL },
  { key: "water_tank", label: "Water storage tank", group: "utilities", for: RES_COM },
  { key: "backup_generator", label: "Backup generator", group: "utilities", for: RES_COM },
  { key: "solar_power", label: "Solar power", group: "utilities", for: RES_COM },
  { key: "solar_water_heating", label: "Solar water heating", group: "utilities", for: RES },
  { key: "fibre_internet", label: "Fibre internet", group: "utilities", for: RES_COM },
  { key: "prepaid_electricity", label: "Prepaid electricity meter", group: "utilities", for: RES_COM },
  { key: "sewer_connection", label: "Sewer connection", group: "utilities", for: RES_COM },
  { key: "fitted_kitchen", label: "Fitted kitchen", group: "interior", for: RES },
  { key: "built_in_wardrobes", label: "Built-in wardrobes", group: "interior", for: RES },
  { key: "en_suite", label: "En-suite bedrooms", group: "interior", for: RES },
  { key: "dsq", label: "Domestic staff quarters (DSQ)", group: "interior", for: RES },
  { key: "study_room", label: "Study room", group: "interior", for: RES },
  { key: "walk_in_closet", label: "Walk-in closet", group: "interior", for: RES },
  { key: "balcony", label: "Balcony", group: "interior", for: RES },
  { key: "fireplace", label: "Fireplace", group: "interior", for: RES },
  { key: "air_conditioning", label: "Air conditioning", group: "interior", for: RES_COM },
  { key: "laundry_room", label: "Laundry room", group: "interior", for: RES },
  { key: "pantry", label: "Pantry", group: "interior", for: RES },
  { key: "wooden_floors", label: "Wooden floors", group: "interior", for: RES },
  { key: "garden", label: "Garden", group: "outdoor", for: RES },
  { key: "swimming_pool", label: "Swimming pool", group: "outdoor", for: RES_COM },
  { key: "terrace", label: "Terrace or rooftop", group: "outdoor", for: RES_COM },
  { key: "bbq_area", label: "BBQ area", group: "outdoor", for: RES },
  { key: "children_play_area", label: "Children's play area", group: "outdoor", for: RES },
  { key: "parking", label: "Parking", group: "building", for: RES_COM },
  { key: "visitor_parking", label: "Visitor parking", group: "building", for: RES_COM },
  { key: "lift", label: "Lift", group: "building", for: RES_COM },
  { key: "tarmac_road", label: "Tarmac road access", group: "building", for: ALL },
  { key: "wheelchair_accessible", label: "Wheelchair accessible", group: "building", for: RES_COM },
  { key: "pet_friendly", label: "Pet friendly", group: "building", for: RES },
  { key: "gym", label: "Gym", group: "lifestyle", for: RES },
  { key: "clubhouse", label: "Clubhouse", group: "lifestyle", for: RES },
  { key: "sauna_steam", label: "Sauna or steam room", group: "lifestyle", for: RES },
  { key: "sports_courts", label: "Sports courts", group: "lifestyle", for: RES },
  { key: "loading_bay", label: "Loading bay", group: "commercial", for: COM },
  { key: "three_phase_power", label: "Three-phase power", group: "commercial", for: COM },
  { key: "reception_area", label: "Reception area", group: "commercial", for: COM },
  { key: "conference_room", label: "Conference room", group: "commercial", for: COM },
  { key: "fire_safety", label: "Fire safety system", group: "commercial", for: COM },
  { key: "road_frontage", label: "Road frontage", group: "land", for: LAND },
  { key: "fenced", label: "Fenced", group: "land", for: LAND },
  { key: "electricity_nearby", label: "Electricity nearby", group: "land", for: LAND },
  { key: "water_on_site", label: "Water on site", group: "land", for: LAND },
  { key: "serviced_plot", label: "Serviced plot", group: "land", for: LAND },
  { key: "flat_terrain", label: "Flat terrain", group: "land", for: LAND },
  { key: "ready_for_development", label: "Ready for development", group: "land", for: LAND },
] as const satisfies readonly { key: string; label: string; group: FeatureGroup; for: readonly PropertyCategory[] }[];
export type FeatureKey = (typeof FEATURES)[number]["key"];
export const FEATURE_KEYS = FEATURES.map((f) => f.key) as unknown as [FeatureKey, ...FeatureKey[]];
export const featuresFor = (category: PropertyCategory) => FEATURES.filter((f) => f.for.includes(category));
export const isFeatureAllowed = (feature: string, category: PropertyCategory) => FEATURES.some((f) => f.key === feature && f.for.includes(category));

export const LISTING_STATUSES = ["draft", "pending_review", "published", "paused", "frozen", "expired", "rejected", "closed"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
/** Why a listing was frozen: the owner did it to make room, or the system did because a paid term ended and the agency is over its Basic limit. */
export const FREEZE_REASONS = ["owner", "over_limit"] as const;
export const CLOSED_REASONS = ["sold", "let", "withdrawn"] as const;
/** Allowed status moves. Moderators can additionally reject or unpublish anything (see access.ts). */
export const STATUS_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ["pending_review", "published", "closed"],
  pending_review: ["published", "rejected", "draft", "closed", "frozen"],
  published: ["paused", "frozen", "expired", "closed", "pending_review"],
  paused: ["published", "closed", "draft"],
  /** Out of sight and out of the count; comes back when there is room or when it is boosted or put in a package. */
  frozen: ["published", "closed", "draft"],
  expired: ["published", "closed", "draft"],
  rejected: ["draft", "closed"],
  closed: ["draft"],
};
export const canMoveStatus = (from: ListingStatus, to: ListingStatus) => from === to || STATUS_TRANSITIONS[from].includes(to);

export const PROMOTION_TIERS = ["none", "boost", "premium"] as const;

export const AGENCY_KINDS = [
  { key: "estate_agency", label: "Estate agency" },
  { key: "developer", label: "Property developer" },
  { key: "property_manager", label: "Property manager" },
  { key: "owner", label: "Owner or landlord" },
] as const;
export const AGENCY_KIND_KEYS = AGENCY_KINDS.map((k) => k.key) as unknown as [(typeof AGENCY_KINDS)[number]["key"], ...(typeof AGENCY_KINDS)[number]["key"][]];
/** Kinds that are expected to hold an Estate Agents Registration Board number. */
export const EARB_KINDS = ["estate_agency", "property_manager"] as const;

export const MEMBER_ROLES = ["owner", "admin", "agent"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
export const MEMBER_STATUSES = ["active", "invited", "removed"] as const;

export const ENQUIRY_STATUSES = ["new", "contacted", "viewing_scheduled", "won", "lost", "spam"] as const;
export const ENQUIRY_CHANNELS = ["form", "phone", "whatsapp"] as const;

export const REPORT_REASONS = [
  { key: "scam", label: "Looks like a scam" },
  { key: "not_available", label: "No longer available" },
  { key: "wrong_price", label: "Wrong price" },
  { key: "wrong_details", label: "Wrong details or location" },
  { key: "misleading_photos", label: "Photos are misleading" },
  { key: "duplicate", label: "Duplicate listing" },
  { key: "offensive", label: "Offensive or discriminatory" },
  { key: "other", label: "Something else" },
] as const;
export const REPORT_REASON_KEYS = REPORT_REASONS.map((r) => r.key) as unknown as [(typeof REPORT_REASONS)[number]["key"], ...(typeof REPORT_REASONS)[number]["key"][]];
export const REPORT_STATUSES = ["open", "reviewing", "actioned", "dismissed"] as const;

export const EVENT_KINDS = ["impression", "view", "save", "unsave", "enquiry", "phone_reveal", "whatsapp_click", "share"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const ALERT_FREQUENCIES = ["instant", "daily", "weekly", "off"] as const;
export const VERIFICATION_STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
export const DEVELOPMENT_STATUSES = ["planning", "off_plan", "under_construction", "completed"] as const;
export const PUBLISH_STATUSES = ["draft", "published", "paused"] as const;
