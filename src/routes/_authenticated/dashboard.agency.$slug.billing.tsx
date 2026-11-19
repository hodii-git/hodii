import { LoaderBlock } from "@/components/loader";
import { PageHeader } from "@/components/dashboard/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { getAgencyPayments } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/billing")({
  head: () => ({ meta: [{ title: "Payments and receipts | Hodii" }, { name: "robots", content: "noindex" }] }),
  component: Billing,
});

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
const label = (k: string) => (k === "premium_package" ? "Premium package" : k === "space_pack" ? "Extra listing space" : "Listing boost");

function Billing() {
  const { slug } = Route.useParams();
  const { data, isPending, isError } = useQuery({ queryKey: ["agency", slug, "billing"], queryFn: () => getAgencyPayments({ data: { slug } }) });
  if (isPending) return <LoaderBlock className="py-10" />;
  if (isError || !data) return <p role="alert" className="text-destructive">Could not load payments.</p>;
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <PageHeader title="Payments and receipts" sub="Print a page as a receipt, or save it as PDF from the print window." right={<button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-bold"><Printer className="h-4 w-4" aria-hidden /> Print</button>} />
      </div>
      <h2 className="hidden text-xl font-bold print:block">{data.agencyName}: payments</h2>
      {data.rows.length === 0 ? <p className="rounded-2xl border border-border p-6 text-muted-foreground">No payments yet.</p> : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Payments</caption>
            <thead className="bg-muted/50 text-left"><tr><th scope="col" className="p-3">Date</th><th scope="col" className="p-3">For</th><th scope="col" className="p-3">M-Pesa receipt</th><th scope="col" className="p-3 text-right">Amount</th><th scope="col" className="p-3">Status</th></tr></thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</td>
                  <td className="p-3">{label(r.kind)}{r.slots ? ` · ${r.slots} listings` : ""}{r.days ? ` · ${r.days} days` : ""}</td>
                  <td className="p-3 font-mono">{r.receipt ?? "—"}</td>
                  <td className="p-3 text-right font-bold">{kes(r.amountKes)}</td>
                  <td className="p-3">{r.status === "refunded" ? "Refunded" : "Paid"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
