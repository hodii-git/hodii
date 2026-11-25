import { createFileRoute, Link } from "@tanstack/react-router";
import { GuideIndex } from "@/components/help/guide";

export const Route = createFileRoute("/help/")({
  validateSearch: (s: Record<string, unknown>): { for?: "agency" | "user" } => (s["for"] === "agency" || s["for"] === "user" ? { for: s["for"] } : {}),
  head: () => ({ meta: [{ title: "Help guide | Hodii" }, { name: "description", content: "Searchable guides for people finding a property and for agencies." }] }),
  component: HelpPage,
});

function HelpPage() {
  const { for: aud } = Route.useSearch();
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-20 pt-32 lg:pt-44">
      <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Help guide</h1>
      <p className="mt-2 text-muted-foreground">Short answers, searchable. Prefer a walkthrough? Every main page has its own short guide: tap the round <b>?</b> button at the bottom left of the page. See <Link to="/info/$slug" params={{ slug: "pricing" }} className="underline">Pricing and limits</Link>.</p>
      <div className="mt-6"><GuideIndex initial={aud ?? "user"} /></div>
    </main>
  );
}
