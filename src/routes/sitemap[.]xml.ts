import { createFileRoute } from "@tanstack/react-router";
import { listingSitemapNames, sitemapIndex } from "@/lib/sitemap";

const headers = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" };

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let total = 0;
        try {
          const { withDb } = await import("@/lib/community.server");
          const { liveFilter } = await import("@/lib/listing-search");
          total = await withDb((db) => db.collection("properties").countDocuments(liveFilter(new Date())));
        } catch (e) { console.error("sitemap: count unavailable", e); }
        return new Response(sitemapIndex(["pages.xml", "locations.xml", "agencies.xml", "developments.xml", "neighbourhoods.xml", ...listingSitemapNames(total)]), { headers });
      },
    },
  },
});
