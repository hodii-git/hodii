import { Link, useRouterState } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";
import { BadgeCheck, BellRing, ExternalLink, Globe, Inbox, Plus, Search, ShieldCheck, Users } from "lucide-react";
import { HodiiLogo } from "@/components/brand-logo";
import { NotificationBell } from "@/components/notification-bell";
import { AccountButton } from "@/components/account-button";
import { useAuth } from "@/hooks/use-auth";
import { can, roleOf, type Subject } from "@/lib/access";
import { useAdminHeader } from "@/lib/dash-header-store";
import { BRAND } from "@/lib/brand";

const L = Link as unknown as ComponentType<Record<string, unknown>>;

/** True for every page that gets the dashboard header instead of the public one. */
export const isDashboardPath = (p: string) => /^\/(dashboard|saved|notifications|profile)(\/|$)/.test(p);
/** Pages that sit inside the dashboard frame (menu on the left, header and footer on the content side). */
export const isFramedPath = (p: string) => isDashboardPath(p) && p !== "/dashboard/agency/new";

const SECTION: Record<string, string> = {
  listings: "Listings", developments: "Developments", enquiries: "Enquiries", space: "Listing space", premium: "Premium", billing: "Payments",
  team: "Team", settings: "Agency settings", import: "Import", promote: "Promote a listing", new: "New", saved: "Saved homes", notifications: "Notifications", profile: "Your profile",
};
const ROLE_TONE: Record<string, string> = { owner: "bg-amber-500/15 text-amber-700 dark:text-amber-300", admin: "bg-violet-500/15 text-violet-700 dark:text-violet-300", agent: "bg-sky-500/15 text-sky-700 dark:text-sky-300" };

const Pill = ({ children, cls = "" }: { children: ReactNode; cls?: string }) => <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{children}</span>;
const Action = ({ to, params, search, icon: I, children, primary }: { to: string; params?: Record<string, string>; search?: Record<string, string>; icon: ComponentType<{ className?: string }>; children: ReactNode; primary?: boolean }) => (
  <L to={to} {...(params ? { params } : {})} {...(search ? { search } : {})} className={`${primary ? "cta" : "border border-border bg-background/70 hover:bg-muted"} hidden h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold md:inline-flex`}>
    <I className="size-4" />{children}
  </L>
);

type AgencyData = { agency: { name: string; access: Subject }; verification: string; newLeads: number };

/**
 * One header for every management page. Its contents change with where you are and who you are:
 * the platform console, an agency workspace (by role) or your personal account.
 */
export function DashHeader({ framed = false }: { framed?: boolean } = {}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const matches = useRouterState({ select: (s) => s.matches });
  const { user } = useAuth();
  const admin = useAdminHeader();
  const agencyMatch = matches.find((m) => m.routeId === "/_authenticated/dashboard/agency/$slug");
  const data = agencyMatch?.loaderData as AgencyData | undefined;
  const slug = (agencyMatch?.params as { slug?: string } | undefined)?.slug;
  const last = path.split("/").filter(Boolean).pop() ?? "";
  const section = SECTION[last] ?? (agencyMatch ? "Overview" : path.startsWith("/dashboard") ? "Enquiries" : "");

  const isAdmin = path.startsWith("/admin");
  const bar = "sq-light";

  let left: ReactNode; let right: ReactNode = null; let tone: "admin" | "agency" | "user" = "user";
  if (isAdmin) {
    tone = "admin";
    left = (
      <div className="flex min-w-0 items-center gap-3">
        <span className="brand-word hidden text-xl font-extrabold sm:inline">{BRAND.name}</span>
        <Pill cls="bg-foreground/[0.06] text-foreground"><ShieldCheck className="size-3.5" />Admin console</Pill>
        {admin?.title && <span className="truncate text-sm font-semibold opacity-80">/ {admin.title}</span>}
      </div>
    );
    right = (
      <>
        {admin && admin.waiting > 0 && <Pill cls="bg-amber-400 text-amber-950"><BellRing className="size-3.5" />{admin.waiting} waiting</Pill>}
        {admin && <Pill cls="bg-foreground/[0.06] text-foreground capitalize">{admin.role}</Pill>}
        <L to="/" className="hidden h-10 items-center gap-2 rounded-full bg-foreground/[0.06] px-4 text-sm font-semibold md:inline-flex"><Globe className="size-4" />View site</L>
      </>
    );
  } else if (agencyMatch && data && slug) {
    tone = "agency";
    const acc = data.agency.access; const role = roleOf(acc);
    left = (
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary font-extrabold text-primary-foreground">{data.agency.name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 leading-tight">
          <p className="flex items-center gap-1 truncate font-extrabold">{data.agency.name}{data.verification === "verified" && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />}</p>
        </div>
      </div>
    );
    const manage = can(acc, "billing.manage");
    right = (
      <>
        {data.newLeads > 0 && can(acc, "lead.view.assigned") && <Action to="/dashboard/agency/$slug/enquiries" params={{ slug }} icon={Inbox}>{data.newLeads} new</Action>}
        {can(acc, "team.invite") && <Action to="/dashboard/agency/$slug/team" params={{ slug }} icon={Users}>Team</Action>}
        {manage
          ? <Action primary to="/dashboard/agency/$slug/premium" params={{ slug }} icon={Plus}>Boost or go Premium</Action>
          : can(acc, "listing.create") ? <Action primary to="/list-property" icon={Plus}>Add listing</Action> : null}
        <L to="/agency/$slug" params={{ slug }} className="hidden h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:text-foreground lg:inline-flex">Public page<ExternalLink className="size-3.5" /></L>
      </>
    );
  } else {
    const agencies = user?.agencies ?? [];
    left = (
      <div className="min-w-0 leading-tight">
        <p className="truncate font-extrabold">Hello, {user?.username ?? "there"}</p>
        <p className="truncate text-xs text-muted-foreground">{section || "Your account"}</p>
      </div>
    );
    right = (
      <>
        {agencies[0] && <Action to="/dashboard/agency/$slug" params={{ slug: agencies[0].slug }} icon={Users}>{agencies[0].name}</Action>}
        <Action to="/properties" icon={Search}>Browse homes</Action>
        {user?.accountType === "agency" ? <Action primary to="/list-property" icon={Plus}>List a property</Action> : null}
      </>
    );
  }

  return (
    <header className={framed ? "dash-top sticky top-0 z-40 px-3 pb-2 pt-3 md:px-6 md:pt-4" : "header-veil fixed inset-x-0 top-0 z-50 isolate px-3 pt-3 md:px-6 md:pt-4"} data-floating data-dash={tone}>
      <div className={`${bar} sq-bar flex w-full items-center gap-3 px-3 md:px-5`}>
        {!framed && (
          <>
            <L to="/" className="flex shrink-0 items-center gap-2 pl-1 font-extrabold" aria-label={`${BRAND.name} home`}>
              {isAdmin ? <ShieldCheck className="size-6" /> : <HodiiLogo />}
              {!isAdmin && <span className="brand-word hidden text-xl lg:inline">{BRAND.name}</span>}
            </L>
            <span aria-hidden className="hidden h-6 w-px bg-current opacity-15 sm:block" />
          </>
        )}
        <div className="min-w-0 flex-1">{left}</div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {right}
          {!isAdmin && (
            <>
              <span className="inline-flex rounded-full hdr-circle header-circle header-size [&>button]:!size-full"><NotificationBell /></span>
              <span className="inline-flex"><AccountButton /></span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** The platform console header: dark bar, current section and what is waiting. It sits outside the signed-in-user shell, so it needs no account data. */
export function AdminBar({ framed = false }: { framed?: boolean } = {}) {
  const admin = useAdminHeader();
  return (
    <header className={framed ? "dash-top sticky top-0 z-40 px-3 pb-2 pt-3 md:px-6 md:pt-4" : "header-veil fixed inset-x-0 top-0 z-50 isolate px-3 pt-3 md:px-6 md:pt-4"} data-floating data-dash="admin">
      <div className="sq-bar flex w-full items-center gap-3 px-3 text-foreground md:px-5">
        {!framed && (
          <>
            <L to="/" className="flex shrink-0 items-center gap-2 pl-1 font-extrabold" aria-label={`${BRAND.name} home`}>
              <ShieldCheck className="size-6" /><span className="hidden text-xl sm:inline">{BRAND.name}</span>
            </L>
            <span aria-hidden className="hidden h-6 w-px bg-current opacity-20 sm:block" />
          </>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Pill cls="bg-foreground/[0.06] text-foreground"><ShieldCheck className="size-3.5" />Admin console</Pill>
          {admin?.title && <span className="truncate text-sm font-semibold opacity-80">/ {admin.title}</span>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {admin && admin.waiting > 0 && <Pill cls="bg-amber-400 text-amber-950"><BellRing className="size-3.5" />{admin.waiting} waiting</Pill>}
          {admin && <Pill cls="bg-foreground/[0.06] text-foreground capitalize">{admin.name} · {admin.role}</Pill>}
          <L to="/" className="hidden h-10 items-center gap-2 rounded-full bg-foreground/[0.06] px-4 text-sm font-semibold md:inline-flex"><Globe className="size-4" />View site</L>
        </div>
      </div>
    </header>
  );
}
