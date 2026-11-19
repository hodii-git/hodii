import { LoaderBlock } from "@/components/loader";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SpaceMeter } from "@/components/dashboard/space-meter";
import { Field, btnPrimary, errorText, inputCls } from "@/components/dashboard/ui";
import { getListingSpace, getPaymentStatus, startSpacePayment } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/space")({
  head: () => ({ meta: [{ title: "Listing space | Hodii" }, { name: "robots", content: "noindex" }] }),
  component: Space,
});

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" });

function Space() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const key = ["agency", slug, "space"];
  const { data, isPending, isError } = useQuery({ queryKey: key, queryFn: () => getListingSpace({ data: { slug } }), refetchOnWindowFocus: true });
  const [phone, setPhone] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting || !paymentId) return;
    const t = setInterval(async () => {
      try {
        const r = await getPaymentStatus({ data: { slug, paymentId } });
        if (r.status === "paid") { setWaiting(false); setPaymentId(null); toast.success("Extra space added"); void qc.invalidateQueries({ queryKey: ["agency", slug] }); }
        else if (r.status !== "pending") { setWaiting(false); toast.error(r.status === "cancelled" ? "The request was cancelled on your phone." : r.status === "expired" ? "We did not get a response in time." : r.message || "The payment did not go through."); }
      } catch { /* keep trying */ }
    }, 4000);
    return () => clearInterval(t);
  }, [waiting, paymentId, slug, qc]);

  const buy = useMutation({
    mutationFn: () => startSpacePayment({ data: { slug, phone } }),
    onSuccess: (r) => { setPaymentId(r.paymentId); setWaiting(true); },
    onError: (e) => toast.error(errorText(e)),
  });

  if (isError) return <p role="alert" className="text-sm text-destructive">Could not load your listing space. Refresh and try again.</p>;
  if (isPending || !data) return <LoaderBlock className="py-10" />;
  const { usage: u, quote: q } = data;
  return (
    <section className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight md:text-3xl"><LayoutGrid className="size-6 text-primary" aria-hidden />Listing space</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">Every agency can keep {u.freeLimit} free listings live. Boosted and Premium listings never count towards that. Need more free-style listings without boosting each one? Add space below.</p>
      </header>

      <div className="rounded-2xl border border-border p-5"><SpaceMeter usage={u} /></div>

      {u.frozen > 0 && (
        <div role="note" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm">
          <p className="font-bold">{u.frozen} listing{u.frozen === 1 ? " is" : "s are"} frozen{u.frozenOverLimit ? `, ${u.frozenOverLimit} because your boost or Premium package ended and you are over the free limit` : ""}.</p>
          <p className="mt-1">To bring them back: boost them, add them to a Premium package, add space here, or freeze or delete other listings to make room.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/dashboard/agency/$slug/listings" params={{ slug }} search={{ status: "frozen" }} className="rounded-full border border-input px-4 py-2 font-semibold">See frozen listings</Link>
            <Link to="/dashboard/agency/$slug/premium" params={{ slug }} className="rounded-full border border-input px-4 py-2 font-semibold">Premium packages</Link>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border p-5">
        <h3 className="text-lg font-extrabold">Add {q.slots} more listings for {q.days} days</h3>
        <p className="mt-1 text-sm text-muted-foreground">{kes(q.priceKes)}. The extra space is added to your free limit straight away. You can buy it again whenever you need more, and when it ends, listings over your limit are frozen, never deleted.</p>
        {!data.canBuy ? <p className="mt-3 text-sm text-muted-foreground">Only the agency owner or an admin can buy space.</p>
          : !data.paymentsEnabled ? <p className="mt-3 text-sm text-muted-foreground">Online payment is not switched on yet. Contact support@hodii.co.ke and we will add the space for you.</p>
          : waiting ? <p role="status" className="mt-3 text-sm">Check your phone and enter your M-Pesa PIN to pay {kes(q.priceKes)}. This page updates by itself.</p>
          : (
            <div className="mt-4 grid gap-4 sm:max-w-md">
              <Field id="mp" label="M-Pesa number" hint="We send a payment request to this phone.">
                <input id="mp" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
              </Field>
              <button type="button" disabled={buy.isPending || phone.trim().length < 9} onClick={() => buy.mutate()} className={btnPrimary}>{buy.isPending ? "Sending request…" : `Pay ${kes(q.priceKes)} with M-Pesa`}</button>
            </div>
          )}
      </div>

      {u.packs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-extrabold">Running extra space</h3>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {u.packs.map((p) => <li key={p.id} className="flex justify-between gap-3 px-4 py-3 text-sm"><span>{p.slots} extra listings</span><span className="text-muted-foreground">until {day(p.endsAt)}</span></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
