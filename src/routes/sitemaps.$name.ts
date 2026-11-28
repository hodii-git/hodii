import { createFileRoute } from "@tanstack/react-router";
import { COUNTY_LIST , COUNTY_LIST_NAIROBI_FIRST } from "@/lib/mongodb/kenya";
import { CATEGORY_SEARCHES } from "@/lib/search-url";
import { infoPages } from "@/data/site-content";
import { SITEMAP_CHUNK, parseListingPart, urlset, type Entry } from "@/lib/sitemap";

const headers = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" };
const xml = (entries: Entry[]) => new Response(urlset(entries), { headers });

export const Route = createFileRoute("/sitemaps/$name")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const name = params.name;
        if (name === "pages.xml") {
          return xml([
            { loc: "/", changefreq: "hourly", priority: "1.0" }, { loc: "/agencies", changefreq: "daily", priority: "0.6" }, { loc: "/developments", changefreq: "daily", priority: "0.7" }, { loc: "/neighbourhoods", changefreq: "daily", priority: "0.7" },
            { loc: "/tools", changefreq: "monthly", priority: "0.5" }, { loc: "/locations", changefreq: "weekly", priority: "0.6" },
            ...Object.keys(CATEGORY_SEARCHES).map((slug) => ({ loc: `/section/${slug}`, changefreq: "daily", priority: "0.7" })),
            ...Object.keys(infoPages).map((slug) => ({ loc: `/info/${slug}`, changefreq: "monthly", priority: "0.3" })),
          ]);
        }
        try {
          const { withDb } = await import("@/lib/community.server");
          const { liveFilter } = await import("@/lib/listing-search");
          if (name === "locations.xml") {
            // Counties always; areas only where something is listed, so we do not offer empty pages to search engines.
            const areas = await withDb((db) => db.collection("properties").aggregate([{ $match: { ...liveFilter(new Date()), "location.areaSlug": { $type: "string" } } }, { $group: { _id: { c: "$location.countyCode", a: "$location.areaSlug" } } }, { $limit: 20000 }]).toArray());
            const byCode = new Map(COUNTY_LIST_NAIROBI_FIRST.map((c) => [c.code, c.slug]));
            return xml([
              ...COUNTY_LIST_NAIROBI_FIRST.map((c) => ({ loc: `/locations/${c.slug}`, changefreq: "daily", priority: "0.6" })),
              ...areas.flatMap((a) => { const cs = byCode.get(Number(a["_id"].c)); return cs ? [{ loc: `/locations/${cs}/${String(a["_id"].a)}`, changefreq: "daily", priority: "0.5" }] : []; }),
            ]);
          }
          if (name === "agencies.xml") {
            const rows = await withDb((db) => db.collection("agencies").find({ status: "active" }, { projection: { slug: 1, updatedAt: 1 } }).limit(SITEMAP_CHUNK * 2).toArray());
            return xml(rows.map((d) => ({ loc: `/agency/${String(d["slug"])}`, lastmod: d["updatedAt"] as Date, changefreq: "weekly", priority: "0.6" })));
          }
          if (name === "neighbourhoods.xml") {
            const areas = await withDb((db) => db.collection("properties").aggregate([{ $match: { ...liveFilter(new Date()), "location.areaSlug": { $type: "string" }, "location.countySlug": { $type: "string" } } }, { $group: { _id: { c: "$location.countySlug", a: "$location.areaSlug" } } }, { $limit: SITEMAP_CHUNK }]).toArray());
            return xml(areas.map((a) => ({ loc: `/neighbourhoods/${String(a["_id"].c)}/${String(a["_id"].a)}`, changefreq: "weekly", priority: "0.6" })));
          }
          if (name === "developments.xml") {
            const live = (await withDb((db) => db.collection("agencies").find({ status: "active" }, { projection: { _id: 1 } }).toArray())).map((a) => String(a["_id"]));
            const rows = await withDb((db) => db.collection("developments").find({ publishStatus: "published", agencyId: { $in: live } }, { projection: { slug: 1, updatedAt: 1 } }).limit(SITEMAP_CHUNK).toArray());
            return xml(rows.map((d) => ({ loc: `/development/${String(d["slug"])}`, lastmod: d["updatedAt"] as Date, changefreq: "weekly", priority: "0.7" })));
          }
          const part = parseListingPart(name);
          if (part !== null && part >= 1) {
            const rows = await withDb((db) => db.collection("properties").find(liveFilter(new Date()), { projection: { slug: 1, updatedAt: 1 } }).sort({ publishedAt: -1, _id: 1 }).skip((part - 1) * SITEMAP_CHUNK).limit(SITEMAP_CHUNK).toArray());
            return xml(rows.map((d) => ({ loc: `/property/${String(d["slug"])}`, lastmod: d["updatedAt"] as Date, changefreq: "weekly", priority: "0.8" })));
          }
        } catch (e) { console.error("sitemap part failed", name, e); return new Response("Temporarily unavailable", { status: 503, headers: { "Retry-After": "300" } }); }
        return new Response("Not found", { status: 404 });
      },
    },
  },
});
