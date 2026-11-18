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
  const tabs = [
    { to: "/dashboard/agency/$slug", label: "Overview", icon: LayoutDashboard, exact: true, show: true },
    { to: "/dashboard/agency/$slug/listings", label: "Listings", icon: ClipboardList, exact: false, show: true },
    { to: "/dashboard/agency/$slug/developments", label: "Developments", icon: Building2, exact: false, show: can(data.agency.role, "development.manage") },
    { to: "/dashboard/agency/$slug/space", label: "Listing space", icon: LayoutGrid, exact: false, show: can(data.agency.role, "billing.manage") },
    { to: "/dashboard/agency/$slug/premium", label: "Premium", icon: Crown, exact: false, show: can(data.agency.role, "billing.manage") },
    { to: "/dashboard/agency/$slug/billing", label: "Payments", icon: Receipt, exact: false, show: can(data.agency.role, "billing.manage") },
    { to: "/dashboard/agency/$slug/enquiries", label: "Enquiries", icon: Inbox, exact: false, show: can(data.agency.role, "lead.view.all") || can(data.agency.role, "lead.view.assigned") },
    { to: "/dashboard/agency/$slug/team", label: "Team", icon: Users, exact: false, show: can(data.agency.role, "team.view") },
    { to: "/dashboard/agency/$slug/settings", label: "Agency", icon: Settings, exact: false, show: true },
  ] as const;
  return (
    <main className="mx-auto max-w-[112rem] px-4 pt-28 pb-24">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Agency dashboard</p>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight md:text-3xl">{data.agency.name}{data.verification === "verified" && <BadgeCheck className="h-5 w-5 text-primary" aria-label="Verified" />}</h1>
        </div>
        <div className="flex items-center gap-4"><Link to="/help" search={{ for: "agency" }} className="text-sm font-bold text-primary hover:underline">Guide</Link><Link to="/agency/$slug" params={{ slug }} className="text-sm font-bold text-primary hover:underline">View public page</Link></div>
      </header>
      <nav aria-label="Dashboard sections" className="mb-8 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.filter((t) => t.show).map((t) => (
          <Link key={t.to} to={t.to} params={{ slug }} data-tour={`tab-${t.label.toLowerCase().replace(/\s+/g, "-")}`} activeOptions={{ exact: t.exact }} className="inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground" activeProps={{ className: "border-primary text-foreground" }}>
            <t.icon className="h-4 w-4" aria-hidden />{t.label}
            {t.label === "Enquiries" && data.newLeads > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{data.newLeads}</span>}
          </Link>
        ))}
      </nav>
      <Outlet />
    </main>
  );
}
