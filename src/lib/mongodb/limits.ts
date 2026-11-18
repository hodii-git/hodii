/** Every limit on listing, agency and enquiry content. Forms, server functions and database validators all read from here. */
export const LISTING_LIMITS = {
  titleMin: 10,
  titleMax: 100,
  descriptionMin: 50,
  descriptionMax: 5000,
  highlightsMax: 6,
  highlightMax: 80,
  imagesMin: 1,
  imagesMax: 30,
  imageBytesMax: 10 * 1024 * 1024,
  imageMinWidth: 640,
  imageMinHeight: 480,
  imageAltMax: 150,
  imageCaptionMax: 150,
  floorPlansMax: 5,
  featuresMax: 40,
  customFeaturesMax: 10,
  nearbyMax: 24,
  nearbyPerCategory: 6,
  nearbyNameMax: 80,
  nearbyMaxMeters: 50_000,
  customFeatureMax: 40,
  priceMin: 1,
  priceMax: 100_000_000_000,
  bedroomsMax: 30,
  bathroomsMax: 30,
  parkingMax: 100,
  floorsMax: 200,
  yearBuiltMin: 1850,
  /** Allows off-plan listings that complete a few years from now. */
  yearBuiltAheadYears: 10,
  plotAreaMaxSqm: 1_000_000_000,
  floorAreaMaxSqm: 10_000_000,
  addressMax: 200,
  landmarkMax: 120,
  areaNameMin: 2,
  areaNameMax: 80,
  externalRefMax: 40,
  priceHistoryMax: 20,
  maxGuests: 50,
  /** Days a published listing stays live before it must be re-confirmed. */
  listingLifetimeDays: 90,
  slugMax: 120,
} as const;

/** Approximate KES per US dollar, used only to compare and sort USD-priced listings with KES ones. Override with the USD_TO_KES environment variable. */
export const USD_TO_KES_DEFAULT = 130;
export const toKes = (amount: number, currency: string, usdRate = USD_TO_KES_DEFAULT) => (currency === "USD" ? Math.round(amount * usdRate) : amount);

export const AGENCY_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  descriptionMax: 2000,
  storyMax: 6000,
  taglineMax: 120,
  servicesMax: 12,
  reviewBodyMax: 1500,
  membersMax: 50,
  serviceAreasMax: 47,
  registrationNumberMax: 40,
} as const;

export const ENQUIRY_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  messageMin: 10,
  messageMax: 1000,
  notesMax: 20,
  noteMax: 500,
  replyMax: 1500,
  repliesPerHour: 20,
} as const;

export const SAVED_LIMITS = {
  propertiesPerUser: 500,
  searchesPerUser: 20,
  searchNameMax: 60,
} as const;

export const REPORT_LIMITS = { detailsMax: 500 } as const;

export const DEVELOPMENT_LIMITS = {
  nameMin: 3,
  nameMax: 100,
  descriptionMin: 50,
  descriptionMax: 5000,
  imagesMin: 1,
  imagesMax: 20,
  unitTypesMax: 20,
} as const;
