import { createFileRoute } from "@tanstack/react-router";
import { WbPage } from "@/components/wb/shell";
import { Faq, PageHero, Reviews, SplitBtn, Wrap, hodiiFaqs } from "@/components/wb/ui";
import { paintings } from "@/lib/wb-images";
import { getPublicPricing } from "@/lib/pricing.functions";
import { defaults } from "@/lib/settings-registry";

export const Route = createFileRoute("/info/pricing")({
  loader: async () => ({ v: (await getPublicPricing().catch(() => null))?.v ?? defaults() }),
  head: () => ({ meta: [{ title: "Pricing and limits | Hodii" }, { name: "description", content: "What is free, what is paid, and how listing limits work on Hodii." }] }),
  component: Pricing,
});

const kes = (n: number) => `KES ${Number(n).toLocaleString("en-KE")}`;
const Card = ({ title, price, note, children, tint, badge, dark }: { title: string; price: string; note?: string; children: React.ReactNode; tint?: string; badge?: string; dark?: boolean }) => (
  <section className="reveal price-card relative flex flex-col overflow-hidden rounded-[1.75rem] p-6 sm:p-7" style={dark ? { background: "color-mix(in oklab, var(--primary) 14%, rgb(255 255 255 / .6))", backdropFilter: "blur(24px) saturate(180%)", boxShadow: "0 24px 60px -28px color-mix(in oklab, var(--primary) 55%, transparent), 0 1px 2px rgb(15 23 42 / .06)" } : { background: "rgb(255 255 255 / .6)", backdropFilter: "blur(24px) saturate(180%)", boxShadow: "0 1px 2px rgb(15 23 42 / .05), 0 18px 44px -26px rgb(15 23 42 / .28)" }}>
    {badge && <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900">{badge}</span>}
    <h2 className="font-display text-lg font-bold">{title}</h2>
    <p className="mt-3 font-display text-3xl font-extrabold">{price}</p>
    {note && <p className={`mt-1 text-sm font-medium ${"text-foreground/60"}`}>{note}</p>}
    <div className={`mt-5 space-y-2.5 border-t pt-4 text-sm ${"border-black/10 text-foreground/80"}`}>{children}</div>
  </section>
);

function Pricing() {
  const { v } = Route.useLoaderData();
  const n = (k: string) => Number(v[k]);
  return (
    <WbPage slug="pricing">
      <PageHero img={paintings.valley} title="Free to search. Fair to list." description={<p>Searching and enquiring are free for everyone. Agencies list for free too, with a cap. Paying lifts the cap and moves your listings up. Amounts below are live.</p>}>
        <div className="rise mt-10 flex justify-center"><SplitBtn to="/list-property">List a property</SplitBtn></div>
      </PageHero>
      <Wrap className="pb-16">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Basic" price="Free" note="Every agency, always">
          <p>Up to <b>{n("basic.maxLive")}</b> live Basic listings.</p>
          <p>Up to <b>{n("basic.maxStored")}</b> Basic listings in total, counting drafts, paused and frozen ones.</p>
          <p>Verified badge once we approve your verification. You can list before that.</p>
        </Card>
        <Card dark badge="Popular" title="Boost one listing" price={`from ${kes(n("boost.dailyBase"))} / day`} note={`Default ${n("boost.defaultDays")} days, up to ${n("boost.maxDays")}`}>
          <p>Daily rate depends on the listing price: {kes(n("boost.dailyHigh"))} (high), {kes(n("boost.dailyMid"))} (mid), {kes(n("boost.dailyBase"))} (base). Longer boosts get a discount.</p>
          <p>A boosted listing does not count towards your Basic cap.</p>
        </Card>
        <Card title="Premium package" price={kes(n("premium.priceKes"))} note={`${n("premium.days")} days, ${n("premium.slots")} listings`}>
          <p>Extra slots {kes(n("premium.extraSlotKes"))} each, up to {n("premium.maxSlots")} in one package.</p>
          <p>Premium listings sit higher in search and do not count towards your Basic cap. Premium members also get more AI searches.</p>
        </Card>
        <Card title="Extra space pack" price={kes(n("space.priceKes"))} note={`${n("space.slots")} more Basic listings for ${n("space.days")} days`}>
          <p>For agencies that need more free-style listings without boosting each one.</p>
        </Card>
      </div>

      <section className="reveal info-card mt-6 space-y-4">
        <h2 className="font-display text-2xl font-semibold">How the limits work</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>Only Basic listings are counted. Boosted and Premium listings are not.</li>
          <li>When a boost or package ends, the listing stays visible as Basic for <b>{n("basic.graceDays")} days</b>. After that, if you are over your cap, the oldest listings are <b>frozen</b>, never deleted.</li>
          <li>A frozen listing is hidden from search. Bring it back by freeing space (freeze or delete another), buying a boost, a Premium slot or a space pack.</li>
          <li>You can freeze a listing yourself at any time to make room. Nothing is lost.</li>
          <li>Listings expire after 90 days. Renew to keep them live.</li>
        </ul>
      </section>

      <section className="reveal info-card mt-6 space-y-4">
        <h2 className="font-display text-2xl font-semibold">How ranking works</h2>
        <p className="max-w-3xl text-sm">Results are ordered by how well they match the search first. Boosted and Premium listings get a small lift, never a guaranteed top spot, and paid listings take at most <b>{n("rank.maxPaidSharePct")}%</b> of a results page. New listings get a small lift for {n("rank.freshDays")} days.</p>
      </section>

      <section className="reveal info-card mt-6 space-y-4">
        <h2 className="font-display text-2xl font-semibold">AI search allowance</h2>
        <p className="text-sm">Per {n("ai.windowHours")} hours: visitors {n("ai.guestLimit")}, signed-in accounts {n("ai.userLimit")}, agency members {n("ai.agencyLimit")}, Premium agency members {n("ai.premiumLimit")}. Normal typed search is unlimited.</p>
      </section>

        <p className="mt-10 text-sm opacity-60">Payments are by M-Pesa. Questions? Visit the help centre or write to us from the contact page.</p>
      </Wrap>
      <Reviews />
      <Faq items={hodiiFaqs} />
    </WbPage>
  );
}
