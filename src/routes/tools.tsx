import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BRAND } from "@/lib/brand";
import { absUrl } from "@/lib/site";
import { Calculator, Home, KeyRound, Wallet } from "lucide-react";
import { affordableLoan, affordableRent, mortgage, rentUpfront } from "@/lib/calculators";

const kes = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;

export const Route = createFileRoute("/tools")({
  validateSearch: (s): { price?: number | undefined; rent?: number | undefined } => ({ ...(Number(s["price"]) > 0 ? { price: Math.round(Number(s["price"])) } : {}), ...(Number(s["rent"]) > 0 ? { rent: Math.round(Number(s["rent"])) } : {}) }),
  head: () => {
    const title = `Mortgage and rent calculators — ${BRAND.name}`;
    const desc = "Work out a monthly home-loan repayment, how much you can borrow, how much rent you can afford and what moving in costs.";
    return { meta: [{ title }, { name: "description", content: desc }, { property: "og:title", content: title }, { property: "og:description", content: desc }], links: [{ rel: "canonical", href: absUrl("/tools") }] };
  },
  component: Tools,
});


type Tab = "loan" | "borrow" | "rent";
const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "loan", label: "Monthly repayment", icon: Calculator },
  { id: "borrow", label: "How much can I borrow?", icon: Wallet },
  { id: "rent", label: "Renting costs", icon: KeyRound },
];

function Field({ id, label, value, onChange, suffix, step = 1, max }: { id: string; label: string; value: number; onChange: (n: number) => void; suffix?: string; step?: number; max?: number }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold">{label}</label>
      <div className="relative rounded-2xl border border-black/10 bg-white/70 shadow-sm focus-within:border-black/25 focus-within:bg-white">
        <input id={id} inputMode="decimal" type="number" min={0} max={max} step={step} value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="h-12 w-full rounded-2xl bg-transparent px-4 pr-16 text-base font-semibold outline-none" />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-xs font-bold text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

const Result = ({ label, value, big = false }: { label: string; value: string; big?: boolean }) => (
  <div className={big ? "rounded-2xl bg-primary p-5 text-primary-foreground" : "rounded-2xl border border-border bg-[#f4f4f5] p-5"}>
    <p className={`text-sm font-semibold ${big ? "opacity-70" : "text-muted-foreground"}`}>{label}</p>
    <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
  </div>
);

function Split({ parts }: { parts: { label: string; value: number; cls: string }[] }) {
  const total = parts.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div className="mt-5">
      <div className="flex h-3 overflow-hidden rounded-full bg-black/5" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}>
        {parts.map((p) => <span key={p.label} className={p.cls} style={{ width: `${(p.value / total) * 100}%` }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold text-muted-foreground">
        {parts.map((p) => <span key={p.label} className="inline-flex items-center gap-1.5"><i className={`inline-block h-2.5 w-2.5 rounded-full ${p.cls}`} />{p.label} · {Math.round((p.value / total) * 100)}%</span>)}
      </div>
    </div>
  );
}

function Tools() {
  const search = Route.useSearch();
  const [tab, setTab] = useState<Tab>(search.rent ? "rent" : "loan");
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
  const upfront = rentUpfront(rent, depositMonths, advance, fee);
  const comfy = affordableRent(income, debts);
  const maxPrice = depositPct < 100 ? borrow / (1 - depositPct / 100) : 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-32 lg:pt-40 pb-24">
      <h1 className="font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">Plan your move, in numbers.</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">Quick estimates for a home loan, what you can borrow, and what moving in really costs. Rates change and lenders decide, so treat these as a guide.</p>

      <div role="tablist" aria-label="Calculators" className="mt-8 inline-flex max-w-full flex-wrap gap-1 rounded-full border border-border bg-white p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${tab === id ? "bg-primary text-primary-foreground shadow-float" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" aria-hidden />{label}
          </button>
        ))}
      </div>

      <section className="mt-6 rounded-[2rem] border border-border bg-white p-6 shadow-sm md:p-8" aria-live="polite">
        {tab === "loan" && (<>
          <div className="grid gap-8 lg:grid-cols-2"><div className="grid content-start gap-4 sm:grid-cols-2">
            <Field id="price" label="Property price" value={price} onChange={setPrice} suffix="KES" step={100000} />
            <Field id="dep" label="Deposit" value={depositPct} onChange={(n) => setDepositPct(Math.min(100, n))} suffix="%" />
            <Field id="rate" label="Interest a year" value={rate} onChange={setRate} suffix="%" step={0.25} />
            <Field id="yrs" label="Loan term" value={years} onChange={(n) => setYears(Math.min(40, n))} suffix="years" />
          </div>
          <div className="grid content-start gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Result big label="Monthly repayment" value={kes(m.monthly)} /></div>
            <Result label="Deposit to save" value={kes(m.deposit)} />
            <Result label="Loan amount" value={kes(m.loan)} />
            <div className="sm:col-span-2"><Result label="Total interest" value={kes(m.totalInterest)} /></div>
            <div className="sm:col-span-2"><Split parts={[{ label: "Deposit", value: m.deposit, cls: "bg-slate-300" }, { label: "Loan", value: m.loan, cls: "bg-primary" }, { label: "Interest", value: m.totalInterest, cls: "bg-slate-500" }]} /></div>
          </div></div>
        </>)}
        {tab === "borrow" && (<>
          <p className="mb-4 text-sm text-muted-foreground">Lenders usually let repayments take up to about a third of your income. This uses the rate, term and deposit from the repayment tab.</p>
          <div className="grid gap-8 lg:grid-cols-2"><div className="grid content-start gap-4 sm:grid-cols-2">
            <Field id="inc" label="Monthly income (before tax)" value={income} onChange={setIncome} suffix="KES" step={5000} />
            <Field id="debt" label="Loan repayments you already make" value={debts} onChange={setDebts} suffix="KES" step={1000} />
            <Field id="rate2" label="Interest a year" value={rate} onChange={setRate} suffix="%" step={0.25} />
            <Field id="dep2" label="Deposit" value={depositPct} onChange={(n) => setDepositPct(Math.min(100, n))} suffix="%" />
          </div>
          <div className="grid content-start gap-3">
            <Result big label="You could borrow about" value={kes(borrow)} />
            <Result label="Property price with your deposit" value={kes(maxPrice)} />
          </div></div>
          {borrow > 0 && <Link to="/properties" search={{ max: String(Math.round(maxPrice)), for: "sale" }} className="cta cta-ink mt-6 inline-flex">See homes up to this price →</Link>}
        </>)}
        {tab === "rent" && (<>
          <div className="grid gap-8 lg:grid-cols-2"><div className="grid content-start gap-4 sm:grid-cols-2">
            <Field id="rinc" label="Monthly income" value={income} onChange={setIncome} suffix="KES" step={5000} />
            <Field id="rent" label="Rent you are considering" value={rent} onChange={setRent} suffix="KES" step={1000} />
            <Field id="dm" label="Deposit (months of rent)" value={depositMonths} onChange={setDepositMonths} step={0.5} />
            <Field id="adv" label="Rent in advance (months)" value={advance} onChange={setAdvance} />
            <Field id="fee" label="Agent fee (% of one month)" value={fee} onChange={setFee} suffix="%" />
          </div>
          <div className="grid content-start gap-3">
            <Result big label="Comfortable rent (30% of income)" value={kes(comfy)} />
            <Result label="Cash needed to move in" value={kes(upfront)} />
            <Result label="Rent as a share of income" value={income > 0 ? `${Math.round((rent / income) * 100)}%` : "—"} />
          </div></div>
          <Link to="/properties" search={{ for: "rent", max: String(comfy) }} className="cta cta-ink mt-6 inline-flex">See rentals within this budget →</Link>
        </>)}
      </section>
    </main>
  );
}
