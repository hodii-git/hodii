/**
 * Single source of truth for the Hodii brand. Never hardcode the name, domain, e-mail
 * addresses or legal entity anywhere else: import them from here.
 *
 * LAUNCH CHECKLIST: confirm the domain, the mailboxes and the legal entity below.
 */
export const BRAND = {
  name: "Hodii",
  /** Lower-case wordmark shown beside the logo. */
  wordmark: "hodii",
  tagline: "Find your place in Kenya",
  description:
    "Hodii is Kenya's property marketplace: houses, apartments, land and commercial space for sale and to rent, listed by verified agencies and owners.",
  domain: "hodii.co.ke",
  url: "https://hodii.co.ke",
  country: "Kenya",
  /** BCP-47 language tag for <html lang>. */
  locale: "en-KE",
  currency: "KES",
  /** Registered company that operates the platform (used in the legal pages). */
  legalName: "Hodii Limited",
  address: "Nairobi, Kenya",
  /** Stored in localStorage; keep in sync with the boot script in theme-toggle. */
  themeStorageKey: "hodii-theme",
  /** The only four addresses Hodii uses: info, hello, contact and support. */
  emails: {
    general: "hello@hodii.co.ke",
    business: "info@hodii.co.ke",
    contact: "contact@hodii.co.ke",
    support: "support@hodii.co.ke",
    agents: "info@hodii.co.ke",
    privacy: "contact@hodii.co.ke",
    legal: "contact@hodii.co.ke",
    report: "support@hodii.co.ke",
  },
} as const;

/** Shown at the top of every legal page. Bump whenever their text changes. */
export const LEGAL_UPDATED = "15 November 2026";
