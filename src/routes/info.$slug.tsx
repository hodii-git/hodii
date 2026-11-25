import { absUrl } from "@/lib/site";
import { BRAND } from "@/lib/brand";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AboutView, CompanyView, GuideView, LegalView, SupportView } from "@/components/wb/info-views";
import { infoPages } from "@/data/site-content";

export const Route = createFileRoute("/info/$slug")({
  loader: ({ params }) => {
    const page = infoPages[params.slug];
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.page;
    const title = p ? `${p.title} — ${BRAND.name}` : `Page not found — ${BRAND.name}`;
    const desc = p?.text ?? "This page could not be found.";
    return {
      meta: [
      { property: "og:url", content: absUrl(`/info/${params.slug}`) },
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: absUrl(`/info/${params.slug}`) }],
    };
  },
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 pt-40 pb-24 text-center">
      <h1 className="text-4xl font-extrabold">Page not found</h1>
      <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Back to home</Link>
    </main>
  ),
  component: InfoPage,
});

const GUIDES = new Set(["buying-guide", "renting-guide", "selling-and-letting", "safety-and-fraud"]);
const LEGAL = new Set(["privacy-policy", "privacy", "terms-of-use", "terms", "terms-and-conditions", "cookie-policy", "cookies", "accessibility"]);
const SUPPORT = new Set(["help-centre", "report-a-listing", "manage-account"]);

function InfoPage() {
  const { page } = Route.useLoaderData();
  const { slug } = Route.useParams();
  if (GUIDES.has(slug)) return <GuideView slug={slug} page={page} />;
  if (LEGAL.has(slug)) return <LegalView slug={slug} page={page} />;
  if (SUPPORT.has(slug)) return <SupportView slug={slug} page={page} />;
  if (slug === "about-us") return <AboutView page={page} />;
  return <CompanyView slug={slug} page={page} />;
}
