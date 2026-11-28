import { BRAND } from "@/lib/brand";

export type HNav = { l: string; to: string };
export type HeaderCfg = {
  kind: "resources" | "company" | "support";
  /** Small label next to the logo or in the ribbon. */
  tag: string;
  ribbon?: string;
  nav: HNav[];
  cta: HNav;
  secondary?: HNav;
};

const RES: HNav[] = [
  { l: "Buying guide", to: "/info/buying-guide" },
  { l: "Renting guide", to: "/info/renting-guide" },
  { l: "Selling and letting", to: "/info/selling-and-letting" },
  { l: "Safety and fraud", to: "/info/safety-and-fraud" },
];
const COMPANY_L: HNav[] = [{ l: "About us", to: "/info/about-us" }, { l: "Careers", to: "/info/careers" }, { l: "Press room", to: "/info/press-room" }];
const COMPANY_R: HNav[] = [{ l: "List with Hodii", to: "/info/list-with-hodii" }, { l: "Advertise", to: "/info/advertise" }, { l: "Pricing", to: "/info/pricing" }];
const SUP: HNav[] = [
  { l: "Help centre", to: "/info/help-centre" },
  { l: "Report a listing", to: "/info/report-a-listing" },
  { l: "Manage account", to: "/info/manage-account" },
];

const resourceCta: Record<string, { tag: string; cta: HNav; secondary: HNav }> = {
  "buying-guide": { tag: "Buying", cta: { l: "Homes for sale", to: "/" }, secondary: { l: "Mortgage tools", to: "/tools" } },
  "renting-guide": { tag: "Renting", cta: { l: "Homes to rent", to: "/" }, secondary: { l: "Compare homes", to: "/compare" } },
  "selling-and-letting": { tag: "Selling and letting", cta: { l: "List a property", to: "/list-property" }, secondary: { l: "See pricing", to: "/info/pricing" } },
  "safety-and-fraud": { tag: "Staying safe", cta: { l: "Report a listing", to: "/info/report-a-listing" }, secondary: { l: "Listing standards", to: "/info/listing-standards" } },
};
const companyRibbon: Record<string, { ribbon: string; cta: HNav }> = {
  "about-us": { ribbon: "Built in Nairobi, for everyone looking for a place in Kenya.", cta: { l: "Browse properties", to: "/" } },
  "list-with-hodii": { ribbon: "List free today. Boost or go Premium when you want more eyes.", cta: { l: "Start listing", to: "/list-property" } },
  "listing-standards": { ribbon: "What every listing on Hodii must include.", cta: { l: "List a property", to: "/list-property" } },
  careers: { ribbon: "We're a small team solving a real problem. Come and help.", cta: { l: "Write to us", to: "/info/contact-us" } },
  "press-room": { ribbon: `Press enquiries are answered within one working day: ${BRAND.emails.business}`, cta: { l: "Contact press", to: "/info/contact-us" } },
  "contact-us": { ribbon: "We answer every message within two working days.", cta: { l: "Help centre", to: "/info/help-centre" } },
  advertise: { ribbon: "Reach people who are actively looking for a place.", cta: { l: "Talk to us", to: "/info/contact-us" } },
  pricing: { ribbon: "Searching is free. Agencies list free, up to a limit.", cta: { l: "List a property", to: "/list-property" } },
};
const supportCta: Record<string, { tag: string; cta: HNav }> = {
  "help-centre": { tag: "Help centre", cta: { l: "Contact support", to: "/info/contact-us" } },
  "report-a-listing": { tag: "Reports", cta: { l: "Safety tips", to: "/info/safety-and-fraud" } },
  "manage-account": { tag: "Your account", cta: { l: "Open my profile", to: "/profile" } },
  "privacy-policy": { tag: "Privacy", cta: { l: "Manage my data", to: "/info/manage-account" } },
  privacy: { tag: "Privacy", cta: { l: "Manage my data", to: "/info/manage-account" } },
  "terms-of-use": { tag: "Terms", cta: { l: "Help centre", to: "/info/help-centre" } },
  terms: { tag: "Terms", cta: { l: "Help centre", to: "/info/help-centre" } },
  "terms-and-conditions": { tag: "Terms", cta: { l: "Help centre", to: "/info/help-centre" } },
  "cookie-policy": { tag: "Cookies", cta: { l: "Manage my data", to: "/info/manage-account" } },
  cookies: { tag: "Cookies", cta: { l: "Manage my data", to: "/info/manage-account" } },
  accessibility: { tag: "Accessibility", cta: { l: "Tell us what's hard", to: "/feedback" } },
};

export function headerFor(slug: string): HeaderCfg {
  if (resourceCta[slug]) return { kind: "resources", nav: RES, ...resourceCta[slug]! };
  if (companyRibbon[slug]) {
    const c = companyRibbon[slug]!;
    return { kind: "company", tag: "Company", ribbon: c.ribbon, nav: [...COMPANY_L, ...COMPANY_R], cta: c.cta };
  }
  const s = supportCta[slug] ?? { tag: "Support", cta: { l: "Contact us", to: "/info/contact-us" } };
  return { kind: "support", tag: s.tag, nav: SUP, cta: s.cta };
}
export const COMPANY_SPLIT = { left: COMPANY_L, right: COMPANY_R };
