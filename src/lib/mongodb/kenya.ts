/** Kenya reference data: the 47 counties, the national bounding box and phone-number handling. Pure and shared by forms, server and scripts. */

export const COUNTIES = [
  [1, "Mombasa"], [2, "Kwale"], [3, "Kilifi"], [4, "Tana River"], [5, "Lamu"], [6, "Taita-Taveta"],
  [7, "Garissa"], [8, "Wajir"], [9, "Mandera"], [10, "Marsabit"], [11, "Isiolo"], [12, "Meru"],
  [13, "Tharaka-Nithi"], [14, "Embu"], [15, "Kitui"], [16, "Machakos"], [17, "Makueni"], [18, "Nyandarua"],
  [19, "Nyeri"], [20, "Kirinyaga"], [21, "Murang'a"], [22, "Kiambu"], [23, "Turkana"], [24, "West Pokot"],
  [25, "Samburu"], [26, "Trans Nzoia"], [27, "Uasin Gishu"], [28, "Elgeyo-Marakwet"], [29, "Nandi"], [30, "Baringo"],
  [31, "Laikipia"], [32, "Nakuru"], [33, "Narok"], [34, "Kajiado"], [35, "Kericho"], [36, "Bomet"],
  [37, "Kakamega"], [38, "Vihiga"], [39, "Bungoma"], [40, "Busia"], [41, "Siaya"], [42, "Kisumu"],
  [43, "Homa Bay"], [44, "Migori"], [45, "Kisii"], [46, "Nyamira"], [47, "Nairobi"],
] as const;

/**
 * Regions used to widen a location search after the county. Nairobi Metro is its own region because Kiambu, Kajiado and Machakos
 * are where most Nairobi buyers and tenants also look.
 */
export const REGIONS: readonly { key: string; name: string; counties: readonly number[] }[] = [
  { key: "nairobi-metro", name: "Nairobi Metro", counties: [47, 22, 34, 16] },
  { key: "central", name: "Central", counties: [18, 19, 20, 21] },
  { key: "coast", name: "Coast", counties: [1, 2, 3, 4, 5, 6] },
  { key: "eastern", name: "Eastern", counties: [10, 11, 12, 13, 14, 15, 17] },
  { key: "north-eastern", name: "North Eastern", counties: [7, 8, 9] },
  { key: "nyanza", name: "Nyanza", counties: [41, 42, 43, 44, 45, 46] },
  { key: "rift-valley", name: "Rift Valley", counties: [23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36] },
  { key: "western", name: "Western", counties: [37, 38, 39, 40] },
];
export const regionOfCounty = (code: number) => REGIONS.find((r) => r.counties.includes(code));

export type County = { code: number; name: string; slug: string };

/** URL-safe slug: lower-case, accents and apostrophes dropped, other runs of characters become one hyphen. */
export const toSlug = (value: string) =>
  value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’`]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const COUNTY_LIST: readonly County[] = COUNTIES.map(([code, name]) => ({ code, name, slug: toSlug(name) }));
/** Counties for dropdowns: Nairobi first (most listings), the rest in county-code order. */
export const COUNTY_LIST_NAIROBI_FIRST: readonly County[] = [...COUNTY_LIST].sort((a, b) => (a.code === 47 ? -1 : b.code === 47 ? 1 : a.name.localeCompare(b.name)));
export const countyByCode = (code: number): County | undefined => COUNTY_LIST.find((c) => c.code === code);
export const countyBySlug = (slug: string): County | undefined => COUNTY_LIST.find((c) => c.slug === slug);
export const COUNTY_SLUGS = COUNTY_LIST.map((c) => c.slug) as [string, ...string[]];

/** Rough bounding box of Kenya: catches swapped or wrong-country coordinates, it is not a border check. */
export const KENYA_BOUNDS = { minLat: -4.9, maxLat: 5.2, minLng: 33.8, maxLng: 42.0 } as const;
export const inKenya = (lat: number, lng: number) =>
  lat >= KENYA_BOUNDS.minLat && lat <= KENYA_BOUNDS.maxLat && lng >= KENYA_BOUNDS.minLng && lng <= KENYA_BOUNDS.maxLng;

/**
 * Normalises a Kenyan phone number to E.164 (+254…), or returns null when it is not one.
 * Accepts 07xx / 01xx mobiles, 254… and +254… forms, and landlines such as 020 xxx xxxx.
 */
export function normalizeKenyaPhone(input: string): string | null {
  let d = input.replace(/[\s().-]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith("254")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  if (/^[17]\d{8}$/.test(d)) return `+254${d}`; // mobile
  if (/^(?:20|4\d|5\d|6\d)\d{6,7}$/.test(d)) return `+254${d}`; // landline, area code + number
  return null;
}
export const E164_KENYA = /^\+254(?:[17]\d{8}|(?:20|4\d|5\d|6\d)\d{6,7})$/;
