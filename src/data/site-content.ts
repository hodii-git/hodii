import { companyPages, resourcePages } from "./info-pages";
import { supportAndLegalPages } from "./legal-pages";

export type InfoPageSection = { heading: string; body?: string[]; bullets?: string[] };
export type InfoPage = {
  title: string;
  text: string;
  /** Optional rich content blocks rendered below the intro on full pages. */
  sections?: InfoPageSection[];
  /** Optional key facts rendered as a stat strip under the intro. */
  facts?: { label: string; value: string }[];
};

/** "info" links open /info/<slugify(label)>; "section" links open a property category (/section/<slug>). */
export type FooterColumn = { heading: string; kind: "section" | "info"; links: string[] };
export const footerSections: FooterColumn[] = [
  { heading: "Properties", kind: "section", links: ["Houses for sale", "Apartments for rent", "Land for sale", "Commercial property", "Short stays", "New developments", "Neighbourhoods"] },
  { heading: "Resources", kind: "info", links: ["Buying guide", "Renting guide", "Selling and letting", "Safety and fraud"] },
  { heading: "Company", kind: "info", links: ["About us", "List with Hodii", "Listing standards", "Careers", "Press room", "Contact us", "Advertise", "Pricing", "Help centre"] },
  { heading: "Support", kind: "info", links: ["Help centre", "Report a listing", "Manage account", "Privacy policy", "Terms of use", "Cookie policy"] },
];

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const infoPages: Record<string, InfoPage> = {
  ...companyPages,
  ...resourcePages,
  ...supportAndLegalPages,
};
