import { LoaderBlock } from "@/components/loader";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Crown, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, btnGhost, btnPrimary, errorText, inputCls } from "@/components/dashboard/ui";
import { addListingsToPackage, getPaymentStatus, getPromoteInfo, startBoostPayment } from "@/lib/payments.functions";
import { BOOST_PRESETS, quoteBoost } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/promote/$id")({
  head: () => ({ meta: [{ title: "Boost your listing | Hodii" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s): { days?: number | undefined } => (Number.isInteger(Number(s["days"])) && Number(s["days"]) > 0 ? { days: Number(s["days"]) } : {}),
  component: Promote,
});

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

function Promote() {
  const { slug, id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ["agency", slug, "promote", id], queryFn: () => getPromoteInfo({ data: { slug, id } }) });
  const { days: startDays } = Route.useSearch();
  const [days, setDays] = useState<number | null>(startDays ?? null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "waiting" | "paid" | "failed">("idle");
  const [message, setMessage] = useState("");
  const done = () => navigate({ to: "/dashboard/agency/$slug/listings", params: { slug } });

  useEffect(() => { if (data?.pendingPaymentId && !paymentId) { setPaymentId(data.pendingPaymentId); setState("waiting"); } }, [data?.pendingPaymentId, paymentId]);

  // Ask for the result every few seconds while the person confirms on their phone.
  useEffect(() => {
    if (state !== "waiting" || !paymentId) return;
    const t = setInterval(async () => {
      try {
        const r = await getPaymentStatus({ data: { slug, paymentId } });
        if (r.status === "paid") { setState("paid"); refetch(); }
        else if (r.status !== "pending") { setState("failed"); setMessage(r.status === "cancelled" ? "The request was cancelled on your phone." : r.status === "expired" ? "We did not get a response in time." : r.message || "The payment did not go through."); }
      } catch { /* keep trying */ }
    }, 4000);
    return () => clearInterval(t);
  }, [state, paymentId, slug, refetch]);

  if (isPending) return <LoaderBlock className="py-10" />;
  if (isError) return <p role="alert" className="text-sm text-destructive">{errorText(error)}</p>;
  const maxDays = data.config.maxDays;
  const chosenDays = days ?? data.config.defaultDays;
  const chosen = quoteBoost(data.priceInput, chosenDays, data.config);
  const addToPackage = async (packageId: string) => {
    try {
      const r = await addListingsToPackage({ data: { slug, packageId, ids: [id] } });
      if (r.added.length) { toast.success("Added to your Premium package"); refetch(); } else toast.error(r.skipped[0]?.reason ?? "Could not add it");
    } catch (e) { toast.error(errorText(e)); }
  };

  const pay = async () => {
    setBusy(true);
    try {
      if (!chosen) return;
      const r = await startBoostPayment({ data: { slug, id, days: chosen.days, phone } });
      setPaymentId(r.paymentId); setState("waiting"); setMessage("");
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };

  if (state === "paid") return (
    <section className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center">
      <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden />
      <h2 className="mt-3 text-2xl font-extrabold">Your listing is boosted</h2>
      <p className="mt-2 text-muted-foreground">{data.title} now gets extra visibility in {data.areaName}.{data.boostUntil && ` It stays boosted until ${new Date(data.boostUntil).toLocaleDateString("en-KE", { dateStyle: "long" })}.`}</p>
      <button type="button" onClick={done} className={`${btnPrimary} mt-6`}>Back to my listings</button>
    </section>
  );

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-sm font-bold text-primary">{data.status === "published" ? "Your listing is live" : data.status === "pending_review" ? "Your listing is awaiting review" : data.status === "frozen" ? "Your listing is frozen" : data.status === "expired" ? "Your listing has expired" : "Your listing is saved as a draft"}</p>
        <h2 className="mt-1 text-2xl font-extrabold">Want more people to see it?</h2>
        <p className="mt-1 text-muted-foreground">{["draft", "frozen", "expired"].includes(data.status) ? <><strong>{data.title}</strong> is not live yet. <strong>It goes live as soon as your payment is confirmed</strong> and the boost starts then, so pay when you are ready. </> : <><strong>{data.title}</strong> is already published. </>}A boost lifts it in search results, shows it with a Boosted badge and can place it in the boosted strips on the home page. Results still favour what people searched for, so a boost helps a good match, it does not replace one. It is optional.</p>
        {data.boostUntil && <p className="mt-2 rounded-xl bg-foreground/10 p-3 text-sm">Already boosted until {new Date(data.boostUntil).toLocaleDateString("en-KE", { dateStyle: "long" })}. Buying more time adds to the end.</p>}
        {data.premiumUntil && <p className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-500/15 p-3 text-sm"><Crown className="size-4" aria-hidden />Premium through your package until {new Date(data.premiumUntil).toLocaleDateString("en-KE", { dateStyle: "long" })}. You do not need to boost it as well.</p>}
      </header>

      {!data.paymentsEnabled ? (
        <div role="note" className="rounded-2xl border border-border bg-muted/40 p-5 text-sm">
          <p className="font-bold">Online payment is not switched on yet.</p>
          <p className="mt-1 text-muted-foreground">Your listing is live and works normally. To boost it now, contact support@hodii.co.ke with the reference code and we will set it up for you.</p>
        </div>
      ) : state === "waiting" ? (
        <div role="status" className="rounded-2xl border border-border p-6 text-center">
          <p className="text-lg font-extrabold">Check your phone</p>
          <p className="mt-1 text-sm text-muted-foreground">Enter your M-Pesa PIN to pay {chosen ? kes(chosen.amountKes) : "the amount shown"}. This page updates by itself.</p>
        </div>
      ) : (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">How many days?</legend>
            <div className="flex flex-wrap gap-2">
              {BOOST_PRESETS.filter((d) => d <= maxDays).map((d) => (
                <button key={d} type="button" aria-pressed={chosenDays === d} onClick={() => setDays(d)} className={`rounded-full border px-4 py-2 text-sm font-bold ${chosenDays === d ? "border-foreground bg-foreground text-background" : "border-border"}`}>{d} days</button>
              ))}
            </div>
            <label htmlFor="days" className="mt-3 block text-sm font-semibold">Or choose any number of days (up to {maxDays})</label>
            <input id="days" type="number" inputMode="numeric" min={1} max={maxDays} step={1} value={chosenDays} onChange={(e) => setDays(Math.max(0, Math.round(Number(e.target.value))))} className={`${inputCls} mt-1 w-32`} />
            {chosen ? (
              <div className="mt-3 rounded-2xl border border-border p-4" aria-live="polite">
                <p className="text-sm text-muted-foreground">{chosen.days} day{chosen.days === 1 ? "" : "s"}</p>
                <p className="text-2xl font-extrabold">{kes(chosen.amountKes)}</p>
                <p className="text-xs text-muted-foreground">{kes(chosen.perDayKes)} a day{chosen.discountPct > 0 && <> · <span className="font-bold text-emerald-700 dark:text-emerald-400">you save {chosen.discountPct}%</span></>}</p>
              </div>
            ) : <p role="alert" className="mt-3 text-sm text-destructive">Choose between 1 and {maxDays} days.</p>}
            <p className="mt-2 text-xs text-muted-foreground">The price follows how busy your area is and the value of the property. Longer boosts cost less per day.</p>
          </fieldset>
          <Field id="phone" label="M-Pesa number" hint="We send a payment request to this phone.">
            <input id="phone" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </Field>
          {state === "failed" && <p role="alert" className="text-sm text-destructive">{message} You have not been charged for a failed request. Try again or skip.</p>}
          <button type="button" disabled={busy || !chosen || phone.trim().length < 9} onClick={pay} className={`${btnPrimary} w-full`}><Rocket className="size-4" aria-hidden />{busy ? "Sending request…" : chosen ? `Pay ${kes(chosen.amountKes)} with M-Pesa` : "Choose the days"}</button>
        </>
      )}

      {data.canBuyPackage && !data.premiumUntil && state !== "waiting" && (
        <aside className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
          <p className="inline-flex items-center gap-2 font-extrabold"><Crown className="size-4" aria-hidden />Have many listings? Go Premium</p>
          <p className="mt-1 text-sm text-muted-foreground">A Premium package puts a block of your listings in Premium placement for a full term at one price. You can swap listings in and out any time.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.packagesWithRoom.map((k) => <button key={k.id} type="button" onClick={() => addToPackage(k.id)} className={btnGhost}>Add to my package ({k.free} free, ends {new Date(k.endsAt).toLocaleDateString("en-KE", { dateStyle: "medium" })})</button>)}
            <Link to="/dashboard/agency/$slug/premium" params={{ slug }} className={btnGhost}>See Premium packages</Link>
          </div>
        </aside>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <button type="button" onClick={done} className={btnGhost}>{state === "waiting" ? "Close, I will check later" : "Skip, no thanks"}</button>
        <Link to="/property/$slug" params={{ slug: data.slug }} className="text-sm font-bold underline">View listing</Link>
      </div>
    </section>
  );
}
