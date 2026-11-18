import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BRAND } from "@/lib/brand";
import { absUrl } from "@/lib/site";
import { affordableLoan, affordableRent, mortgage, rentUpfront } from "@/lib/calculators";

const kes = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;
const input = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";

export const Route = createFileRoute("/tools")({
  validateSearch: (s): { price?: number | undefined; rent?: number | undefined } => ({ ...(Number(s["price"]) > 0 ? { price: Math.round(Number(s["price"])) } : {}), ...(Number(s["rent"]) > 0 ? { rent: Math.round(Number(s["rent"])) } : {}) }),
  head: () => {
    const title = `Mortgage and rent calculators — ${BRAND.name}`;
    const desc = "Work out a monthly home-loan repayment, how much you can borrow, how much rent you can afford and what moving in costs.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }], links: [{ rel: "canonical", href: absUrl("/tools") }] };
  },
  component: Tools,
});

function Field({ id, label, value, onChange, suffix, step = 1 }: { id: string; label: string; value: number; onChange: (n: number) => void; suffix?: string; step?: number }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      <div className="relative"><input id={id} inputMode="decimal" type="number" min={0} step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} className={input} />{suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}</div>
    </div>
  );
}
const Result = ({ label, value, big = false }: { label: string; value: string; big?: boolean }) => <div className="glass-strong rounded-2xl px-4 py-3"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className={`mt-1 font-extrabold ${big ? "text-2xl" : "text-lg"}`}>{value}</p></div>;

function Tools() {
  const search = Route.useSearch();
  const [price, setPrice] = useState(search.price ?? 10_000_000);
  const [depositPct, setDepositPct] = useState(20);
  const [rate, setRate] = useState(13);
  const [years, setYears] = useState(20);
  const [income, setIncome] = useState(200_000);
  const [debts, setDebts] = useState(0);
  const [rent, setRent] = useState(search.rent ?? 40_000);
  const [depositMonths, setDepositMonths] = useState(2);
  const [advance, setAdvance] = useState(1);
  const [fee, setFee] = useState(0);
  const m = useMemo(() => mortgage(price, depositPct, rate, years), [price, depositPct, rate, years]);
  const borrow = useMemo(() => affordableLoan(income, debts, 33, rate, years), [income, debts, rate, years]);
  return (
    <main className="mx-auto max-w-5xl px-4 pt-28 pb-24">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Mortgage and rent calculators</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Quick estimates to help you plan. Interest rates change and lenders decide their own terms, so ask your bank for an offer before you commit.</p>

      <section aria-labelledby="mort" className="glass mt-8 rounded-3xl p-6">
        <h2 id="mort" className="text-xl font-extrabold">Home-loan repayment</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="price" label="Property price" value={price} onChange={setPrice} suffix="KES" step={100000} />
          <Field id="dep" label="Deposit" value={depositPct} onChange={(n) => setDepositPct(Math.min(100, n))} suffix="%" />
          <Field id="rate" label="Interest rate a year" value={rate} onChange={setRate} suffix="%" step={0.25} />
          <Field id="yrs" label="Loan term" value={years} onChange={(n) => setYears(Math.min(40, n))} suffix="years" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
          <Result big label="Monthly repayment" value={kes(m.monthly)} />
          <Result label="Deposit to save" value={kes(m.deposit)} />
          <Result label="Loan amount" value={kes(m.loan)} />
          <Result label="Total interest" value={kes(m.totalInterest)} />
        </div>
      </section>

      <section aria-labelledby="afford" className="glass mt-6 rounded-3xl p-6">
        <h2 id="afford" className="text-xl font-extrabold">How much can I borrow?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Lenders usually let repayments take up to about a third of your income. This uses the rate and term above.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="inc" label="Monthly income (before tax)" value={income} onChange={setIncome} suffix="KES" step={5000} />
          <Field id="debt" label="Monthly loan repayments you already make" value={debts} onChange={setDebts} suffix="KES" step={1000} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite">
          <Result big label="You could borrow about" value={kes(borrow)} />
          <Result label="Property price with your deposit" value={kes(depositPct < 100 ? borrow / (1 - depositPct / 100) : 0)} />
        </div>
        {borrow > 0 && <Link to="/properties" search={{ max: String(Math.round(borrow / (1 - depositPct / 100))), for: "sale" }} className="mt-4 inline-block font-semibold text-primary">See homes up to this price →</Link>}
      </section>

      <section aria-labelledby="rent" className="glass mt-6 rounded-3xl p-6">
        <h2 id="rent" className="text-xl font-extrabold">Renting: what you can afford and what moving in costs</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="rinc" label="Monthly income" value={income} onChange={setIncome} suffix="KES" step={5000} />
          <Field id="rent" label="Rent you are considering" value={rent} onChange={setRent} suffix="KES" step={1000} />
          <Field id="dm" label="Deposit (months of rent)" value={depositMonths} onChange={setDepositMonths} step={0.5} />
          <Field id="adv" label="Rent paid in advance (months)" value={advance} onChange={setAdvance} step={1} />
          <Field id="fee" label="Agent fee (% of one month)" value={fee} onChange={setFee} suffix="%" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-live="polite">
          <Result big label="Comfortable rent (30% of income)" value={kes(affordableRent(income, debts))} />
          <Result label="Cash needed to move in" value={kes(rentUpfront(rent, depositMonths, advance, fee))} />
          <Result label="Rent as a share of income" value={income > 0 ? `${Math.round((rent / income) * 100)}%` : "—"} />
        </div>
        <Link to="/properties" search={{ for: "rent", max: String(affordableRent(income, debts)) }} className="mt-4 inline-block font-semibold text-primary">See rentals within this budget →</Link>
      </section>
    </main>
  );
}
