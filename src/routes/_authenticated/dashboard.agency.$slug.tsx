import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { BadgeCheck, Building2, ClipboardList, Crown, Receipt, Inbox, LayoutGrid, LayoutDashboard, Settings, Users } from "lucide-react";
import { getAgencyOverview } from "@/lib/dashboard.functions";
import { can } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug")({
  head: () => ({ meta: [{ title: "Agency dashboard — Hodii" }, { name: "robots", content: "noindex" }] }),
  // Loading the overview doubles as the membership check: anyone who is not on the team gets the error screen.
  loader: ({ params }) => getAgencyOverview({ data: { slug: params.slug } }),
  staleTime: 0,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-lg px-4 pt-32 pb-24 text-center">
      <h1 className="text-2xl font-extrabold">You can't open this dashboard</h1>
      <p className="mt-2 text-muted-foreground">{error instanceof Error && !/^[[{]/.test(error.message) ? error.message : "Something went wrong."}</p>
      <Link to="/dashboard" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Back to your dashboard</Link>
    </main>
  ),
  component: AgencyLayout,
});

function AgencyLayout() {
  const data = Route.useLoaderData();
  const { slug } = useParams({ from: "/_authenticated/dashboard/agency/$slug" });
  const r = data.agency.role;
  const groups = [
    { title: "Workspace", items: [
      { to: "/dashboard/agency/$slug", label: "Overview", icon: LayoutDashboard, exact: true, show: true },
      { to: "/dashboard/agency/$slug/listings", label: "Listings", icon: ClipboardList, exact: false, show: true },
      { to: "/dashboard/agency/$slug/developments", label: "Developments", icon: Building2, exact: false, show: can(r, "development.manage") },
      { to: "/dashboard/agency/$slug/enquiries", label: "Enquiries", icon: Inbox, exact: false, show: can(r, "lead.view.all") || can(r, "lead.view.assigned") },
    ] },
    { title: "Business", items: [
      { to: "/dashboard/agency/$slug/space", label: "Listing space", icon: LayoutGrid, exact: false, show: can(r, "billing.manage") },
      { to: "/dashboard/agency/$slug/premium", label: "Premium", icon: Crown, exact: false, show: can(r, "billing.manage") },
      { to: "/dashboard/agency/$slug/billing", label: "Payments", icon: Receipt, exact: false, show: can(r, "billing.manage") },
    ] },
    { title: "Manage", items: [
      { to: "/dashboard/agency/$slug/team", label: "Team", icon: Users, exact: false, show: can(r, "team.view") },
      { to: "/dashboard/agency/$slug/settings", label: "Agency", icon: Settings, exact: false, show: true },
    ] },
  ] as const;
  const base = "relative inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground lg:w-full";
  const active = "bg-primary/10 !text-primary";
  return (
    <main className="mx-auto max-w-[82rem] px-4 pt-24 pb-24 lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-8">
      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="hidden items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:flex">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground">{data.agency.name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-extrabold"><span className="truncate">{data.agency.name}</span>{data.verification === "verified" && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />}</p>
            <p className="text-xs capitalize text-muted-foreground">{r.replace(/_/g, " ")}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <p className="flex min-w-0 items-center gap-1 text-lg font-extrabold"><span className="truncate">{data.agency.name}</span>{data.verification === "verified" && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />}</p>
          <Link to="/agency/$slug" params={{ slug }} className="shrink-0 text-sm font-bold text-primary">Public page</Link>
        </div>
        <nav aria-label="Dashboard sections" className="mt-3 flex gap-1 overflow-x-auto pb-2 lg:mt-5 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-0">
          {groups.map((g) => {
            const items = g.items.filter((t) => t.show);
            if (!items.length) return null;
            return (
              <div key={g.title} className="flex gap-1 lg:flex-col">
                <p className="hidden px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground lg:block">{g.title}</p>
                {items.map((t) => (
                  <Link key={t.to} to={t.to} params={{ slug }} data-tour={`tab-${t.label.toLowerCase().replace(/\s+/g, "-")}`} activeOptions={{ exact: t.exact }} className={base} activeProps={{ className: `${base} ${active}`, "aria-current": "page" }}>
                    <t.icon className="size-[18px]" aria-hidden />{t.label}
                    {t.label === "Enquiries" && data.newLeads > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground lg:ml-auto">{data.newLeads}</span>}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="mt-5 hidden space-y-2 lg:block">
          <Link to="/help" search={{ for: "agency" }} className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Dashboard guide<span aria-hidden>→</span></Link>
          <Link to="/agency/$slug" params={{ slug }} className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">View public page<span aria-hidden>→</span></Link>
        </div>
      </aside>
      <div className="mt-4 min-w-0 lg:mt-0"><Outlet /></div>
    </main>
  );
}
