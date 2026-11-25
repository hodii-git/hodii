import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { AlertTriangle, BadgeCheck, Building2, Clock, ShieldAlert, ClipboardList, Crown, Receipt, Inbox, LayoutGrid, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Plus, Settings, Users } from "lucide-react";
import { getAgencyOverview } from "@/lib/dashboard.functions";
import { can, roleOf } from "@/lib/access";
import { DashFrame } from "@/components/dashboard/dash-frame";
import { DashHeader } from "@/components/dashboard/dash-header";
import { AttentionProvider, type Attention } from "@/components/dashboard/attention";

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
  const r = data.agency.access;
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
  const attention: Attention[] = [];
  const v = data.verification;
  if (v === "rejected") attention.push({ id: "ver", level: "urgent", title: "Verification was not approved", text: "Your listings stay live without the badge. Check the reason and send your details again.", to: "/dashboard/agency/$slug/settings", params: { slug }, cta: "Fix it" });
  else if (v === "unverified" || !v) attention.push({ id: "ver", level: "warn", title: "Your agency is not verified yet", text: "You can list now. Add your registration details to earn the verified badge.", to: "/dashboard/agency/$slug/settings", params: { slug }, cta: "Verify" });
  else if (v === "pending") attention.push({ id: "ver", level: "info", title: "Verification in progress", text: "We are checking your details. You can keep listing; the badge appears once approved." });
  if (data.newLeads > 0 && (can(r, "lead.view.all") || can(r, "lead.view.assigned"))) attention.push({ id: "leads", level: "warn", title: `${data.newLeads} new enquir${data.newLeads === 1 ? "y" : "ies"} waiting`, text: "Reply the same day. Fast replies win deals.", to: "/dashboard/agency/$slug/enquiries", params: { slug }, cta: "Reply" });
  const frozen = Number((data.statuses as Record<string, number>)?.["frozen"] ?? 0);
  if (frozen > 0) attention.push({ id: "frozen", level: "warn", title: `${frozen} listing${frozen === 1 ? " is" : "s are"} frozen`, text: "You are over your free space. Free some room or go Premium to bring them back.", to: "/dashboard/agency/$slug/space", params: { slug }, cta: "See space" });
  const rejected = Number((data.statuses as Record<string, number>)?.["rejected"] ?? 0);
  if (rejected > 0) attention.push({ id: "rej", level: "urgent", title: `${rejected} listing${rejected === 1 ? " was" : "s were"} rejected`, text: "Open the listing to see what to fix, then submit it again.", to: "/dashboard/agency/$slug/listings", params: { slug }, cta: "Review" });
  const sideGroups = groups.map((g) => ({ title: g.title, items: g.items.filter((t) => t.show).map((t) => ({ key: t.to, to: t.to, params: { slug }, label: t.label, icon: t.icon, exact: t.exact, tour: `tab-${t.label.toLowerCase().replace(/\s+/g, "-")}`, badge: t.label === "Enquiries" ? data.newLeads : 0 })) }));
  return (
    <DashFrame
      label="Dashboard sections"
      bar={<DashHeader framed />}
      brand={
        <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-3">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground">{data.agency.name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-extrabold"><span className="truncate">{data.agency.name}</span>{v === "verified" && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />}</p>
            <p className="text-xs capitalize text-muted-foreground">{roleOf(r)}{r.permissions ? " · custom access" : ""}</p>
          </div>
        </div>
      }
      groups={[...(can(r, "listing.create") ? [{ items: [{ key: "add", to: "/dashboard/agency/$slug/listings/$id", params: { slug, id: "new" }, label: "Add listing", icon: Plus, cta: true, tour: "add-listing" }] }] : []), ...sideGroups]}
      extra={<>
        <Link to="/help" search={{ for: "agency" }} className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-muted">Dashboard guide<span aria-hidden>→</span></Link>
        <Link to="/agency/$slug" params={{ slug }} className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-muted">View public page<span aria-hidden>→</span></Link>
      </>}
    >
      <AttentionProvider items={attention}><Outlet /></AttentionProvider>
    </DashFrame>
  );
}
