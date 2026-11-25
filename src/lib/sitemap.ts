import { absUrl } from "./site";

/** Sitemaps: an index that points at small files, so no file nears the 50,000-address limit and a slow query cannot break them all. */
export const SITEMAP_CHUNK = 5000;
export type Entry = { loc: string; lastmod?: Date | string | null | undefined; changefreq?: string | undefined; priority?: string | undefined };

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const iso = (d: Date | string | null | undefined) => { if (!d) return ""; const t = new Date(d); return Number.isNaN(t.getTime()) ? "" : `<lastmod>${t.toISOString()}</lastmod>`; };

export function urlset(entries: Entry[]): string {
  const body = entries.map((e) => `  <url><loc>${esc(absUrl(e.loc))}</loc>${iso(e.lastmod)}${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ""}${e.priority ? `<priority>${e.priority}</priority>` : ""}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapIndex(names: string[], now = new Date()): string {
  const body = names.map((n) => `  <sitemap><loc>${esc(absUrl(`/sitemaps/${n}`))}</loc><lastmod>${now.toISOString()}</lastmod></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/** Names of the listing files for a given number of live listings: listings-1.xml … listings-n.xml (at least one). */
export const listingSitemapNames = (total: number) => Array.from({ length: Math.max(1, Math.ceil(total / SITEMAP_CHUNK)) }, (_, i) => `listings-${i + 1}.xml`);

export const parseListingPart = (name: string): number | null => { const m = /^listings-(\d{1,4})\.xml$/.exec(name); return m ? Number(m[1]) : null; };
