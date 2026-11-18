import { BRAND } from "@/lib/brand";

/** Public site identity: one place for the domain used in canonical links, share tags, sitemap and emails. */
export const SITE_URL = BRAND.url;
export const SITE_NAME = BRAND.name;
export const EMAIL_DOMAIN = BRAND.domain;
export const CONTACT_EMAIL = BRAND.emails.general;

/** Absolute URL on the public domain for a site path ("/article/x" → "https://hodii.co.ke/article/x"). */
export const absUrl = (path = "/") => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`);
