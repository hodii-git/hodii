import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, btnGhost, btnPrimary, errorText, inputCls } from "@/components/dashboard/ui";
import { addListingsToPackage, getPackages, getPaymentStatus, removeListingFromPackage, startPackagePayment } from "@/lib/payments.functions";
import { packagePrice } from "@/lib/promotions";

export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/premium")({
  head: () => ({ meta: [{ title: "Premium packages | Hodii" }, { name: "robots", content: "noindex" }] }),
  component: Premium,
});

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" });

function Premium() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const key = ["agency", slug, "packages"];
  const { data, isPending, isError, error } = useQuery({ queryKey: key, queryFn: () => getPackages({ data: { slug } }), refetchOnWindowFocus: true });
  const [slots, setSlots] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [renew, setRenew] = useState<string | undefined>(undefined);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  useEffect(() => {
    if (!waiting || !paymentId) return;
    const t = setInterval(async () => {
      try {
        const r = await getPaymentStatus({ data: { slug, paymentId } });
        if (r.status === "paid") { setWaiting(false); setPaymentId(null); toast.success("Package active"); refresh(); }
        else if (r.status !== "pending") { setWaiting(false); toast.error(r.status === "cancelled" ? "The request was cancelled on your phone." : r.status === "expired" ? "We did not get a response in time." : r.message || "The payment did not go through."); }
      } catch { /* keep trying */ }
    }, 4000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, paymentId, slug]);

  const buy = useMutation({
    mutationFn: (n: number) => startPackagePayment({ data: { slug, slots: n, phone, ...(renew ? { renewFrom: renew } : {}) } }),
    onSuccess: (r) => { setPaymentId(r.paymentId); setWaiting(true); },
    onError: (e) => toast.error(errorText(e)),
  });
  const add = useMutation({
    mutationFn: (v: { packageId: string; ids: string[] }) => addListingsToPackage({ data: { slug, ...v } }),
    onSuccess: (r) => { if (r.added.length) toast.success(`Added ${r.added.length} listing${r.added.length === 1 ? "" : "s"}`); if (r.skipped.length) toast.error(`${r.skipped.length} could not be added: ${r.skipped[0]!.reason}`); refresh(); },
    onError: (e) => toast.error(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: (v: { packageId: string; listingId: string }) => removeListingFromPackage({ data: { slug, ...v } }),
    onSuccess: () => { toast.success("Removed from the package"); refresh(); }, onError: (e) => toast.error(errorText(e)),
  });
  const [pick, setPick] = useState<Record<string, string[]>>({});
  const [confirming, setConfirming] = useState<string | null>(null);

  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError) return <p role="alert" className="text-sm text-destructive">{errorText(error)}</p>;
  const c = data.config;
  const n = slots ?? c.slots;
  const q = packagePrice(n, c);
  const active = data.packages.filter((p) => p.state === "active");
  const ended = data.packages.filter((p) => p.state === "expired");

  return (
    <section className="space-y-8">
      <header>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold"><Crown className="size-6 text-amber-500" aria-hidden />Premium packages</h2>
        <p className="mt-1 max-w-2xl text-muted-foreground">A package gives a number of your listings Premium placement for {c.days} days: a Premium badge, a lift in search and a place in the Premium strips on the home page. Add and remove listings whenever you like. Buy another package any time; they run side by side.</p>
      </header>

      <div className="rounded-2xl border border-border p-5">
        <h3 className="text-lg font-extrabold">{renew ? "Renew a package" : "Buy a package"}</h3>
        {!data.paymentsEnabled ? <p className="mt-2 text-sm text-muted-foreground">Online payment is not switched on yet. Contact support@hodii.co.ke and we will set up your package.</p> : waiting ? (
          <p role="status" className="mt-3 text-sm">Check your phone and enter your M-Pesa PIN to pay {q ? kes(q.priceKes) : ""}. This page updates by itself.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field id="slots" label="Listings in this package" hint={`${c.slots} are included. Each extra listing adds ${kes(c.extraSlotKes)}. Up to ${c.maxSlots}.`}>
              <input id="slots" type="number" inputMode="numeric" min={1} max={c.maxSlots} value={n} onChange={(e) => setSlots(Math.max(0, Math.round(Number(e.target.value))))} className={inputCls} />
            </Field>
            <Field id="mp" label="M-Pesa number" hint="We send a payment request to this phone.">
              <input id="mp" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </Field>
            <div className="sm:col-span-2" aria-live="polite">
              {q ? <p className="text-2xl font-extrabold">{kes(q.priceKes)} <span className="text-sm font-normal text-muted-foreground">for {q.slots} listings, {q.days} days{renew ? ", with your current listings added back automatically" : ""}</span></p> : <p role="alert" className="text-sm text-destructive">Choose between 1 and {c.maxSlots} listings.</p>}
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="button" disabled={!q || buy.isPending || phone.trim().length < 9} onClick={() => buy.mutate(n)} className={btnPrimary}>{buy.isPending ? "Sending request…" : q ? `Pay ${kes(q.priceKes)} with M-Pesa` : "Pay"}</button>
              {renew && <button type="button" onClick={() => setRenew(undefined)} className={btnGhost}>Buy a new package instead</button>}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-extrabold">Running ({active.length})</h3>
        {!active.length && <p className="text-sm text-muted-foreground">No running packages.</p>}
        {active.map((p) => {
          const chosen = pick[p.id] ?? [];
          const free = p.slots - p.listings.length;
          return (
            <article key={p.id} className="rounded-2xl border border-border p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-extrabold">{p.listings.length} of {p.slots} listings used</p>
                <p className="text-sm text-muted-foreground">{p.daysLeft} day{p.daysLeft === 1 ? "" : "s"} left · ends {day(p.endsAt)}</p>
              </div>
              <ul className="mt-3 divide-y divide-border">
                {p.listings.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate"><strong>{l.title}</strong> <span className="text-muted-foreground">{l.referenceCode}{l.status !== "published" ? ` · ${l.status.replace("_", " ")}` : ""}</span></span>
                    {confirming === l.id ? (
                      <span className="flex items-center gap-2"><span className="text-xs text-muted-foreground">It drops to Basic now. Time already paid is not refunded.</span><button type="button" className="text-sm font-bold text-destructive" onClick={() => { setConfirming(null); remove.mutate({ packageId: p.id, listingId: l.id }); }}>Yes, remove</button><button type="button" className="text-sm font-semibold" onClick={() => setConfirming(null)}>Keep</button></span>
                    ) : <button type="button" className="text-sm font-semibold text-destructive" onClick={() => setConfirming(l.id)}>Remove</button>}
                  </li>
                ))}
                {!p.listings.length && <li className="py-2 text-sm text-muted-foreground">No listings yet. Add some below.</li>}
              </ul>
              {free > 0 && data.available.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-bold">Add listings ({free} slot{free === 1 ? "" : "s"} free)</p>
                  <ul className="mt-2 max-h-56 space-y-1 overflow-auto rounded-xl border border-border p-2">
                    {data.available.map((l) => (
                      <li key={l.id}><label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"><input type="checkbox" checked={chosen.includes(l.id)} onChange={(e) => setPick({ ...pick, [p.id]: e.target.checked ? [...chosen, l.id].slice(0, free) : chosen.filter((x) => x !== l.id) })} /><span className="truncate">{l.title} <span className="text-muted-foreground">{l.referenceCode}</span></span></label></li>
                    ))}
                  </ul>
                  <button type="button" disabled={!chosen.length || add.isPending} onClick={() => add.mutate({ packageId: p.id, ids: chosen }, { onSuccess: () => setPick({ ...pick, [p.id]: [] }) })} className={`${btnPrimary} mt-2`}>Add {chosen.length || ""} selected</button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {ended.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-extrabold">Ended</h3>
          {ended.map((p) => (
            <article key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4 text-sm">
              <div><p className="font-bold">{p.slots} slots · {kes(p.priceKes)}</p><p className="text-muted-foreground">{day(p.startsAt)} to {day(p.endsAt)} · {p.listings.length} listing{p.listings.length === 1 ? "" : "s"}</p></div>
              {data.paymentsEnabled && <button type="button" className={btnGhost} onClick={() => { setRenew(p.id); setSlots(p.slots); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Renew this package</button>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
