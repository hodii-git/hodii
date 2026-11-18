import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicPricing } from "@/lib/pricing.functions";
import { defaults } from "@/lib/settings-registry";

export const Route = createFileRoute("/info/pricing")({
  loader: async () => ({ v: (await getPublicPricing().catch(() => null))?.v ?? defaults() }),
  head: () => ({ meta: [{ title: "Pricing and limits | Hodii" }, { name: "description", content: "What is free, what is paid, and how listing limits work on Hodii." }] }),
  component: Pricing,
});

const kes = (n: number) => `KES ${Number(n).toLocaleString("en-KE")}`;
const Card = ({ title, price, note, children }: { title: string; price: string; note?: string; children: React.ReactNode }) => (
  <section className="glass rounded-3xl p-6">
    <h2 className="text-lg font-bold">{title}</h2>
    <p className="mt-1 text-3xl font-extrabold">{price}</p>
    {note && <p className="text-sm text-muted-foreground">{note}</p>}
    <div className="mt-4 space-y-2 text-sm">{children}</div>
  </section>
);

function Pricing() {
  const { v } = Route.useLoaderData();
  const n = (k: string) => Number(v[k]);
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-16 pt-28">
      <h1 className="text-3xl font-extrabold">Pricing and limits</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Searching and enquiring are free for everyone. Agencies list for free too, with a cap. Paying lifts the cap and moves your listings up. Amounts below are live and always match what you are charged.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Basic" price="Free" note="Every agency, always">
          <p>Up to <b>{n("basic.maxLive")}</b> live Basic listings.</p>
          <p>Up to <b>{n("basic.maxStored")}</b> Basic listings in total, counting drafts, paused and frozen ones.</p>
          <p>Verified badge once we approve your verification. You can list before that.</p>
        </Card>
        <Card title="Boost one listing" price={`from ${kes(n("boost.dailyBase"))} / day`} note={`Default ${n("boost.defaultDays")} days, up to ${n("boost.maxDays")}`}>
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

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-bold">How the limits work</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>Only Basic listings are counted. Boosted and Premium listings are not.</li>
          <li>When a boost or package ends, the listing stays visible as Basic for <b>{n("basic.graceDays")} days</b>. After that, if you are over your cap, the oldest listings are <b>frozen</b>, never deleted.</li>
          <li>A frozen listing is hidden from search. Bring it back by freeing space (freeze or delete another), buying a boost, a Premium slot or a space pack.</li>
          <li>You can freeze a listing yourself at any time to make room. Nothing is lost.</li>
          <li>Listings expire after 90 days. Renew to keep them live.</li>
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-bold">How ranking works</h2>
        <p className="max-w-3xl text-sm">Results are ordered by how well they match the search first. Boosted and Premium listings get a small lift, never a guaranteed top spot, and paid listings take at most <b>{n("rank.maxPaidSharePct")}%</b> of a results page. New listings get a small lift for {n("rank.freshDays")} days.</p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-2xl font-bold">AI search allowance</h2>
        <p className="text-sm">Per {n("ai.windowHours")} hours: visitors {n("ai.guestLimit")}, signed-in accounts {n("ai.userLimit")}, agency members {n("ai.agencyLimit")}, Premium agency members {n("ai.premiumLimit")}. Normal typed search is unlimited.</p>
      </section>

      <p className="mt-10 text-sm text-muted-foreground">Payments are by M-Pesa. Questions? <Link to="/help" className="underline">Read the guide</Link> or <Link to="/feedback" className="underline">tell us</Link>.</p>
    </main>
  );
}
