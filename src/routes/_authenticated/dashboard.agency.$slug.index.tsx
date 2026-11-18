import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { AlertTriangle, Plus } from "lucide-react";
import { Stat, btnPrimary } from "@/components/dashboard/ui";
import { can } from "@/lib/access";

const parent = getRouteApi("/_authenticated/dashboard/agency/$slug");
export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/")({ component: Overview });

function Overview() {
  const d = parent.useLoaderData();
  const { slug } = Route.useParams();
  const live = d.statuses["published"] ?? 0, review = d.statuses["pending_review"] ?? 0, draft = d.statuses["draft"] ?? 0, expired = d.statuses["expired"] ?? 0, rejected = d.statuses["rejected"] ?? 0;
  const max = Math.max(1, ...d.series.map((s) => s.views));
  return (
    <div className="space-y-8">
      {d.verification !== "verified" && (
        <div role="note" className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p>{d.verification === "pending" ? <><strong>Verification in progress.</strong> Our team is checking your details. You can keep listing: your listings go live straight away. The verified badge appears on your agency and listings once we approve it.</> : d.verification === "rejected" ? <>Your verification was not approved. Your listings stay live, but without the verified badge. <Link to="/dashboard/agency/$slug/settings" params={{ slug }} className="font-bold underline">Fix your details and apply again</Link>.</> : <>Your agency is not verified yet. You can list now and your listings go live straight away. <Link to="/dashboard/agency/$slug/settings" params={{ slug }} className="font-bold underline">Add your registration details</Link> to apply for the verified badge.</>}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Live listings" value={live} /><Stat label="Views, 30 days" value={d.last30.views.toLocaleString("en-KE")} />
        <Stat label="Enquiries, 30 days" value={d.last30.enquiries} /><Stat label="Phone reveals, 30 days" value={d.last30.phoneReveals} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {([["In review", review], ["Drafts", draft], ["Expired", expired], ["Rejected", rejected]] as const).map(([l, n]) => (
          <Link key={l} to="/dashboard/agency/$slug/listings" params={{ slug }} search={{ status: ({ "In review": "pending_review", Drafts: "draft", Expired: "expired", Rejected: "rejected" } as const)[l] }} className="glass flex items-center justify-between rounded-2xl p-4 hover:bg-muted/50"><span className="text-sm font-semibold">{l}</span><span className="text-xl font-extrabold">{n}</span></Link>
        ))}
      </div>
      {d.newLeads > 0 && <p className="text-sm"><Link to="/dashboard/agency/$slug/enquiries" params={{ slug }} className="font-bold text-primary underline">{d.newLeads} new {d.newLeads === 1 ? "enquiry is" : "enquiries are"} waiting for a reply.</Link></p>}
      {d.series.length > 0 && (
        <section aria-labelledby="trend" className="glass rounded-3xl p-5">
          <h2 id="trend" className="mb-4 text-lg font-extrabold">Views per day</h2>
          <div className="flex h-32 items-end gap-1" role="img" aria-label={`Views over the last ${d.series.length} days with activity, highest ${max}`}>
            {d.series.map((s) => <div key={s.date} title={`${s.date}: ${s.views} views, ${s.enquiries} enquiries`} className="min-w-1 flex-1 rounded-t bg-primary/70" style={{ height: `${Math.max(4, (s.views / max) * 100)}%` }} />)}
          </div>
        </section>
      )}
      {can(d.agency.role, "listing.create") && <Link to="/dashboard/agency/$slug/listings/$id" params={{ slug, id: "new" }} className={btnPrimary}><Plus className="h-4 w-4" aria-hidden />Add a listing</Link>}
    </div>
  );
}
