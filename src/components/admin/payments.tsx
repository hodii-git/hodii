import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sel } from "@/components/ui/sel";
import { useState } from "react";
import { toast } from "sonner";
import { adminListPayments, adminRecordPackage, adminRecordPayment, adminRecordSpace, adminRefundPayment, adminRevenue } from "@/lib/admin.functions";
import { LoaderBlock } from "@/components/loader";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
const cls = "h-10 rounded-xl border border-input bg-background px-3 text-sm";

/** Boost and Premium payments, and forms to record one taken outside the site. */
export function Payments() {
  const qc = useQueryClient();
  const { data, isPending, isError } = useQuery({ queryKey: ["admin", "payments"], queryFn: () => adminListPayments() });
  const [f, setF] = useState({ reference: "", days: "30", amount: "", receipt: "" });
  const record = useMutation({
    mutationFn: () => adminRecordPayment({ data: { reference: f.reference, days: Number(f.days), amountKes: Number(f.amount), receipt: f.receipt.trim() || null } }),
    onSuccess: () => { toast.success("Recorded. The listing is boosted."); setF({ reference: "", days: "30", amount: "", receipt: "" }); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not record"),
  });
  const [pk, setPk] = useState({ agency: "", slots: "10", amount: "", receipt: "" });
  const recordPk = useMutation({
    mutationFn: () => adminRecordPackage({ data: { agencySlug: pk.agency, slots: Number(pk.slots), amountKes: Number(pk.amount), receipt: pk.receipt.trim() || null } }),
    onSuccess: () => { toast.success("Recorded. The package is active."); setPk({ agency: "", slots: "10", amount: "", receipt: "" }); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not record"),
  });
  const [sp, setSp] = useState({ agency: "", amount: "", receipt: "" });
  const recordSp = useMutation({
    mutationFn: () => adminRecordSpace({ data: { agencySlug: sp.agency, amountKes: Number(sp.amount), receipt: sp.receipt.trim() || null } }),
    onSuccess: () => { toast.success("Recorded. The extra space is active."); setSp({ agency: "", amount: "", receipt: "" }); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not record"),
  });
  const [days, setDays] = useState(30);
  const rev = useQuery({ queryKey: ["admin", "revenue", days], queryFn: () => adminRevenue({ data: { days } }) });
  const refund = useMutation({
    mutationFn: (v: { id: string; note: string }) => adminRefundPayment({ data: v }),
    onSuccess: (r) => { if (r.ok) { toast.success("Refund recorded. The paid benefit has ended."); qc.invalidateQueries({ queryKey: ["admin"] }); } else toast.error(r.error); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not record refund"),
  });
  const askRefund = (id: string) => { const note = window.prompt("Why is this being refunded? (kept on record). Return the money by M-Pesa reversal; this ends the boost or package."); if (note && note.trim().length >= 3) refund.mutate({ id, note: note.trim() }); };
  if (isPending) return <LoaderBlock />;
  if (isError) return <p role="alert" className="text-sm text-destructive">Could not load payments.</p>;
  return (
    <div className="space-y-6">
      <section aria-label="Revenue" className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Revenue</h2>
          <Sel aria-label="Period" className={cls} value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}</Sel></div>
        {rev.isPending ? <LoaderBlock /> : rev.isError ? <p role="alert" className="text-sm text-destructive">Could not load revenue.</p> : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">Net</p><p className="text-2xl font-extrabold">{kes(rev.data.netKes)}</p></div>
              <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">Gross</p><p className="text-2xl font-extrabold">{kes(rev.data.grossKes)}</p></div>
              <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">Refunded</p><p className="text-2xl font-extrabold">{kes(rev.data.refundedKes)}</p><p className="text-xs text-muted-foreground">{rev.data.refundCount} payments</p></div>
              <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">Average sale</p><p className="text-2xl font-extrabold">{kes(rev.data.averageKes)}</p></div>
            </div>
            <div className="flex h-24 items-end gap-px rounded-2xl border border-border p-3" role="img" aria-label={`Daily net revenue for the last ${days} days`}>
              {(() => { const max = Math.max(1, ...rev.data.byDay.map((d) => d.kes)); return rev.data.byDay.map((d) => <div key={d.day} title={`${d.day}: ${kes(d.kes)}`} className="min-w-px flex-1 rounded-t bg-primary/70" style={{ height: `${Math.max(2, (d.kes / max) * 100)}%` }} />); })()}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ul className="divide-y divide-border rounded-2xl border border-border text-sm">{rev.data.byKind.map((k) => <li key={k.kind} className="flex justify-between p-3"><span>{k.kind === "premium_package" ? "Premium packages" : k.kind === "space_pack" ? "Extra space" : "Boosts"} <span className="text-muted-foreground">· {k.count}</span></span><b>{kes(k.kes)}</b></li>)}{!rev.data.byKind.length && <li className="p-3 text-muted-foreground">No sales in this period.</li>}</ul>
              <ul className="divide-y divide-border rounded-2xl border border-border text-sm">{rev.data.topAgencies.map((a) => <li key={a.agencyId} className="flex justify-between p-3"><span className="truncate">{a.name} <span className="text-muted-foreground">· {a.count}</span></span><b>{kes(a.kes)}</b></li>)}{!rev.data.topAgencies.length && <li className="p-3 text-muted-foreground">No agencies yet.</li>}</ul>
            </div>
            {rev.data.stuck.length > 0 && (
              <div role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-bold">{rev.data.stuck.length} payment{rev.data.stuck.length === 1 ? "" : "s"} waiting over 30 minutes</p>
                <p className="text-muted-foreground">The customer was prompted but no result came back. Check the M-Pesa statement; if the money arrived, record it below.</p>
                <ul className="mt-2 list-disc pl-5">{rev.data.stuck.map((s) => <li key={s.id}>{kes(s.amountKes)} · {s.kind} · phone ending {s.phoneHint ?? "?"} · {new Date(s.createdAt).toLocaleString("en-KE")}</li>)}</ul>
              </div>
            )}
          </>
        )}
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">Revenue (last 100 payments)</p><p className="text-2xl font-extrabold">{kes(data.paidTotalKes)}</p></div>
        <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-2xl font-extrabold">{data.paidCount}</p></div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); record.mutate(); }} className="flex flex-wrap items-end gap-3 rounded-2xl border border-border p-4">
        <div><label className="block text-xs font-bold" htmlFor="pr">Listing reference</label><input id="pr" required className={cls} placeholder="HD-7K3M2Q" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
        <div><label className="block text-xs font-bold" htmlFor="pd">Days</label><input id="pd" type="number" min={1} max={365} required className={`${cls} w-24`} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></div>
        <div><label className="block text-xs font-bold" htmlFor="pa">Amount (KES)</label><input id="pa" type="number" min={0} required className={`${cls} w-32`} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
        <div><label className="block text-xs font-bold" htmlFor="pc">Receipt (optional)</label><input id="pc" className={cls} value={f.receipt} onChange={(e) => setF({ ...f, receipt: e.target.value })} /></div>
        <button disabled={record.isPending} className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Record boost</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); recordPk.mutate(); }} className="flex flex-wrap items-end gap-3 rounded-2xl border border-border p-4">
        <div><label className="block text-xs font-bold" htmlFor="ka">Agency address name</label><input id="ka" required className={cls} placeholder="acme-realty" value={pk.agency} onChange={(e) => setPk({ ...pk, agency: e.target.value })} /></div>
        <div><label className="block text-xs font-bold" htmlFor="ks">Listing slots</label><input id="ks" type="number" min={1} required className={`${cls} w-24`} value={pk.slots} onChange={(e) => setPk({ ...pk, slots: e.target.value })} /></div>
        <div><label className="block text-xs font-bold" htmlFor="kp">Amount (KES)</label><input id="kp" type="number" min={0} required className={`${cls} w-32`} value={pk.amount} onChange={(e) => setPk({ ...pk, amount: e.target.value })} /></div>
        <div><label className="block text-xs font-bold" htmlFor="kr">Receipt (optional)</label><input id="kr" className={cls} value={pk.receipt} onChange={(e) => setPk({ ...pk, receipt: e.target.value })} /></div>
        <button disabled={recordPk.isPending} className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Record Premium package</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); recordSp.mutate(); }} className="flex flex-wrap items-end gap-3 rounded-2xl border border-border p-4">
        <div><label className="block text-xs font-bold" htmlFor="sa">Agency address name</label><input id="sa" required className={cls} placeholder="acme-realty" value={sp.agency} onChange={(e) => setSp({ ...sp, agency: e.target.value })} /></div>
        <div><label className="block text-xs font-bold" htmlFor="sm">Amount (KES)</label><input id="sm" type="number" min={0} required className={`${cls} w-32`} value={sp.amount} onChange={(e) => setSp({ ...sp, amount: e.target.value })} /></div>
        <div><label className="block text-xs font-bold" htmlFor="sr">Receipt (optional)</label><input id="sr" className={cls} value={sp.receipt} onChange={(e) => setSp({ ...sp, receipt: e.target.value })} /></div>
        <button disabled={recordSp.isPending} className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Record extra space</button>
      </form>
      {!data.rows.length ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {data.rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-bold">{r.listing} <span className="font-normal text-muted-foreground">· {r.agency}</span></span>
              <span>{r.kind === "premium_package" ? `Premium · ${r.slots} slots` : r.kind === "space_pack" ? `Extra space · ${r.slots} listings` : "Boost"} · {r.days} days · {kes(r.amountKes)}</span>
              <span className="text-xs text-muted-foreground">{r.provider === "manual" ? "Manual" : "M-Pesa"}{r.receipt ? ` · ${r.receipt}` : ""} · {new Date(r.createdAt).toLocaleDateString("en-KE")}</span>
              {r.status === "paid" && <button type="button" className="text-xs underline" disabled={refund.isPending} onClick={() => askRefund(r.id)}>Refund</button>}
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.status === "paid" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
