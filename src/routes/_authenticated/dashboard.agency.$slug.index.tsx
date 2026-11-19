import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Eye, FileEdit, Home, Inbox, MessageSquare, Phone, Plus, TimerOff, XCircle, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { useGreeting } from "@/components/use-greeting";
import { btnPrimary } from "@/components/dashboard/ui";
import { can } from "@/lib/access";

const parent = getRouteApi("/_authenticated/dashboard/agency/$slug");
export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/")({ component: Overview });


function Kpi({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`} aria-hidden>{icon}</span>
      <p className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Views as an area line with enquiries as bars underneath, drawn as plain SVG so it needs no chart library. */
function Trend({ series }: { series: { date: string; views: number; enquiries: number }[] }) {
  const W = 600, H = 180, pad = 4;
  const maxV = Math.max(1, ...series.map((s) => s.views)), maxE = Math.max(1, ...series.map((s) => s.enquiries));
  const x = (i: number) => (series.length < 2 ? W / 2 : pad + (i / (series.length - 1)) * (W - pad * 2));
  const y = (v: number) => H - 24 - (v / maxV) * (H - 40);
  const line = series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.views).toFixed(1)}`).join(" ");
  const area = series.length > 1 ? `${line} L${x(series.length - 1).toFixed(1)},${H - 24} L${x(0).toFixed(1)},${H - 24} Z` : "";
  const total = series.reduce((a, s) => a + s.views, 0), leads = series.reduce((a, s) => a + s.enquiries, 0);
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label={`Views over ${series.length} active days: ${total} views and ${leads} enquiries in total. Busiest day had ${maxV} views.`} preserveAspectRatio="none">
        {[0, 0.5, 1].map((g) => <line key={g} x1="0" x2={W} y1={H - 24 - g * (H - 40)} y2={H - 24 - g * (H - 40)} stroke="currentColor" className="text-border" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />)}
        {area && <path d={area} className="fill-primary/10" />}
        <path d={line} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="stroke-primary" vectorEffect="non-scaling-stroke" />
        {series.map((s, i) => s.enquiries > 0 && <rect key={s.date} x={x(i) - 3} width="6" y={H - 22 - (s.enquiries / maxE) * 18} height={(s.enquiries / maxE) * 18 + 0.5} rx="2" className="fill-foreground/70"><title>{`${fmt(s.date)}: ${s.enquiries} enquiries`}</title></rect>)}
        {series.map((s, i) => <circle key={`c${s.date}`} cx={x(i)} cy={y(s.views)} r="8" fill="transparent"><title>{`${fmt(s.date)}: ${s.views} views, ${s.enquiries} enquiries`}</title></circle>)}
      </svg>
      <figcaption className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{series.length ? fmt(series[0]!.date) : ""}</span><span className="flex items-center gap-3"><span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-primary" />Views</span><span className="inline-flex items-center gap-1"><i className="size-2 rounded-sm bg-foreground/70" />Enquiries</span></span><span>{series.length ? fmt(series[series.length - 1]!.date) : ""}</span></figcaption>
    </figure>
  );
}

function Overview() {
  const d = parent.useLoaderData();
  const { slug } = Route.useParams();
  const greeting = useGreeting();
  const n = (k: string) => d.statuses[k] ?? 0;
  const live = n("published"), review = n("pending_review"), draft = n("draft"), expired = n("expired"), rejected = n("rejected");
  const total = Math.max(1, live + review + draft + expired + rejected);
  const attention = [
    { to: "/dashboard/agency/$slug/enquiries", icon: <Inbox className="size-4" />, label: "New enquiries", n: d.newLeads, tone: "text-primary bg-primary/10", search: undefined },
    { to: "/dashboard/agency/$slug/listings", icon: <Clock className="size-4" />, label: "Waiting for review", n: review, tone: "text-amber-600 bg-amber-500/15", search: { status: "pending_review" } },
    { to: "/dashboard/agency/$slug/listings", icon: <TimerOff className="size-4" />, label: "Expired, renew to show again", n: expired, tone: "text-orange-600 bg-orange-500/15", search: { status: "expired" } },
    { to: "/dashboard/agency/$slug/listings", icon: <XCircle className="size-4" />, label: "Rejected, needs changes", n: rejected, tone: "text-red-600 bg-red-500/15", search: { status: "rejected" } },
    { to: "/dashboard/agency/$slug/listings", icon: <FileEdit className="size-4" />, label: "Drafts not published", n: draft, tone: "text-muted-foreground bg-muted", search: { status: "draft" } },
  ] as const;
  const open = attention.filter((a) => a.n > 0);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{greeting}, {d.username}</h1>
          <p className="text-sm text-muted-foreground">{d.scope === "agency" ? `Here is how ${d.agency.name} is doing.` : `Here is how your own listings at ${d.agency.name} are doing.`}</p>
        </div>
        {can(d.agency.role, "listing.create") && <Link to="/dashboard/agency/$slug/listings/$id" params={{ slug, id: "new" }} className={btnPrimary}><Plus className="size-4" aria-hidden />Add a listing</Link>}
      </header>

      {d.verification !== "verified" && (
        <div role="note" className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
          <p>{d.verification === "pending" ? <><strong>Verification in progress.</strong> Our team is checking your details. You can keep listing: your listings go live straight away. The verified badge appears on your agency and listings once we approve it.</>
            : d.verification === "rejected" ? <>Your verification was not approved. Your listings stay live, but without the verified badge. <Link to="/dashboard/agency/$slug/settings" params={{ slug }} className="font-bold underline">Fix your details and apply again</Link>.</>
            : <>Your agency is not verified yet. You can list now and your listings go live straight away. <Link to="/dashboard/agency/$slug/settings" params={{ slug }} className="font-bold underline">Request verification</Link> to earn the verified badge.</>}</p>
        </div>
      )}

      {d.canSeeStats && <section aria-label="Last 30 days" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi icon={<Home className="size-5" />} label="Live listings" value={live} tone="bg-primary/10 text-primary" />
        <Kpi icon={<Eye className="size-5" />} label="Views, 30 days" value={d.last30.views.toLocaleString("en-KE")} tone="bg-sky-500/15 text-sky-600" />
        <Kpi icon={<MessageSquare className="size-5" />} label="Enquiries, 30 days" value={d.last30.enquiries.toLocaleString("en-KE")} tone="bg-violet-500/15 text-violet-600" />
        <Kpi icon={<Phone className="size-5" />} label="Phone reveals, 30 days" value={d.last30.phoneReveals.toLocaleString("en-KE")} tone="bg-emerald-500/15 text-emerald-600" />
      </section>}

      <div className={`grid gap-6 ${d.canSeeStats ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}>
        {d.canSeeStats && <section aria-labelledby="trend" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 id="trend" className="text-lg font-extrabold">Views and enquiries</h2>
          <p className="mb-3 text-sm text-muted-foreground">Days with activity, last 30 days</p>
          {d.series.length ? <Trend series={d.series} /> : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No views yet. Once people open your listings, the chart fills in.</p>}
        </section>}

        <section aria-labelledby="attn" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 id="attn" className="text-lg font-extrabold">Needs your attention</h2>
          {open.length === 0 ? <p className="mt-3 rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">All clear. Nothing is waiting on you.</p> : (
            <ul className="mt-3 space-y-1">
              {open.map((a) => (
                <li key={a.label}><Link to={a.to} params={{ slug }} {...(a.search ? { search: a.search as never } : {})} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${a.tone}`} aria-hidden>{a.icon}</span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">{a.label}</span>
                  <span className="text-sm font-extrabold tabular-nums">{a.n}</span><ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" aria-hidden />
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="mix" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 id="mix" className="text-lg font-extrabold">Your listings by status</h2>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${live} live, ${review} in review, ${draft} drafts, ${expired} expired, ${rejected} rejected`}>
          {([[live, "bg-emerald-500"], [review, "bg-amber-500"], [draft, "bg-slate-400"], [expired, "bg-orange-500"], [rejected, "bg-red-500"]] as const).map(([v, c], i) => v > 0 && <span key={i} className={c} style={{ width: `${(v / total) * 100}%` }} />)}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {([["Live", live, "bg-emerald-500"], ["In review", review, "bg-amber-500"], ["Drafts", draft, "bg-slate-400"], ["Expired", expired, "bg-orange-500"], ["Rejected", rejected, "bg-red-500"]] as const).map(([l, v, c]) => <li key={l} className="inline-flex items-center gap-2"><i className={`size-2.5 rounded-full ${c}`} /><span className="text-muted-foreground">{l}</span><b className="tabular-nums">{v}</b></li>)}
        </ul>
      </section>
    </div>
  );
}
