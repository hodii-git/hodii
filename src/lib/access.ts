import type { ListingStatus, MemberRole } from "./mongodb/taxonomy";

/**
 * Who may do what. Pure functions, no database, so the same rules protect server functions and decide which buttons dashboards show.
 *
 * A person has one sign-in. What they can reach depends on their memberships:
 *   - everyone gets the personal dashboard (saved homes, searches, enquiries sent);
 *   - each agency they belong to adds an agency dashboard, with what they can do there set by their role;
 *   - Hodii staff use the separate admin sign-in, which is not covered here.
 */
export type Action =
  | "listing.create" | "listing.edit.own" | "listing.edit.any" | "listing.publish" | "listing.delete" | "listing.assign"
  | "development.manage"
  | "lead.view.assigned" | "lead.view.all" | "lead.manage.assigned" | "lead.manage.all"
  | "analytics.view.own" | "analytics.view.all"
  | "team.view" | "team.invite" | "team.remove" | "team.change_role"
  | "agency.edit" | "agency.submit_verification" | "agency.delete" | "billing.manage";

const AGENT: readonly Action[] = ["listing.create", "listing.edit.own", "listing.publish", "lead.view.assigned", "lead.manage.assigned", "analytics.view.own", "team.view"];
const ADMIN: readonly Action[] = [
  ...AGENT, "listing.edit.any", "listing.delete", "listing.assign", "development.manage", "lead.view.all", "lead.manage.all",
  "analytics.view.all", "team.invite", "team.remove", "agency.edit", "agency.submit_verification", "billing.manage",
];
const OWNER: readonly Action[] = [...ADMIN, "team.change_role", "agency.delete"];

export const ROLE_ACTIONS: Record<MemberRole, readonly Action[]> = { agent: AGENT, admin: ADMIN, owner: OWNER };
/** The same rules in plain words, grouped, so the Team page shows what each role can do straight from ROLE_ACTIONS. */
export const ACTION_GROUPS: readonly { group: string; items: readonly { action: Action; label: string }[] }[] = [
  { group: "Listings", items: [
    { action: "listing.create", label: "Create listings" }, { action: "listing.edit.own", label: "Edit their own listings" }, { action: "listing.edit.any", label: "Edit anyone's listings" },
    { action: "listing.publish", label: "Publish listings" }, { action: "listing.assign", label: "Assign a listing to an agent" }, { action: "listing.delete", label: "Delete listings" }, { action: "development.manage", label: "Manage developments" } ] },
  { group: "Enquiries", items: [
    { action: "lead.view.assigned", label: "See and reply to enquiries on their listings" }, { action: "lead.view.all", label: "See every enquiry in the agency" }, { action: "lead.manage.all", label: "Assign and close any enquiry" } ] },
  { group: "Numbers", items: [{ action: "analytics.view.own", label: "See stats for their own listings" }, { action: "analytics.view.all", label: "See stats for the whole agency" }] },
  { group: "Team", items: [{ action: "team.view", label: "See the team" }, { action: "team.invite", label: "Add people" }, { action: "team.remove", label: "Remove agents" }, { action: "team.change_role", label: "Change roles and remove admins" }] },
  { group: "Agency", items: [{ action: "agency.edit", label: "Edit agency profile and settings" }, { action: "agency.submit_verification", label: "Submit for verification" }, { action: "billing.manage", label: "Buy boosts and Premium" }, { action: "agency.delete", label: "Delete the agency" }] },
];
export const can = (role: MemberRole, action: Action) => ROLE_ACTIONS[role].includes(action);

export type Membership = { agencyId: string; userId: string; role: MemberRole };

export function canEditListing(m: Membership, listing: { agencyId: string; createdBy: string; agentId: string | null }) {
  if (m.agencyId !== listing.agencyId) return false;
  if (can(m.role, "listing.edit.any")) return true;
  return can(m.role, "listing.edit.own") && (listing.createdBy === m.userId || listing.agentId === m.userId);
}

export function canViewLead(m: Membership, lead: { agencyId: string; agentId: string | null; assignedTo: string | null }) {
  if (m.agencyId !== lead.agencyId) return false;
  if (can(m.role, "lead.view.all")) return true;
  return can(m.role, "lead.view.assigned") && (lead.agentId === m.userId || lead.assignedTo === m.userId);
}

export function canManageLead(m: Membership, lead: { agencyId: string; agentId: string | null; assignedTo: string | null }) {
  if (!canViewLead(m, lead)) return false;
  return can(m.role, "lead.manage.all") || can(m.role, "lead.manage.assigned");
}

/** Owners can remove anyone; admins can remove agents only. Nobody removes an owner through this check: owners are demoted or the agency is deleted. */
export function canRemoveMember(actor: MemberRole, target: MemberRole) {
  if (!can(actor, "team.remove")) return false;
  if (actor === "owner") return target !== "owner";
  return target === "agent";
}
/** Only owners change roles, and an agency always keeps at least one owner. */
export function canChangeRole(actor: MemberRole, target: MemberRole, next: MemberRole, ownerCount: number) {
  if (!can(actor, "team.change_role")) return false;
  if (target === "owner" && next !== "owner" && ownerCount <= 1) return false;
  return true;
}
/** Admins can invite agents and other admins; only owners can invite owners. */
export const canInviteRole = (actor: MemberRole, role: MemberRole) => can(actor, "team.invite") && (role !== "owner" || actor === "owner");

/**
 * Which status a listing takes when its author presses Publish. Every active agency publishes straight away, verified or not:
 * verification only decides the verified badge, and staff take listings down afterwards if they have to. Suspended agencies cannot publish.
 */
export function statusOnPublish(agency: { status: "active" | "suspended"; verification?: "unverified" | "pending" | "verified" | "rejected" | undefined }): ListingStatus | null {
  return agency.status === "suspended" ? null : "published";
}

export type Dashboard =
  | { kind: "personal"; path: "/dashboard" }
  | { kind: "agency"; path: string; agencyId: string; agencySlug: string; agencyName: string; role: MemberRole };

export type AgencyRef = { id: string; slug: string; name: string; role: MemberRole };

/** Dashboards a signed-in person can open, and the one they land on after signing in. */
export function dashboardsFor(accountType: "user" | "agency" | undefined, agencies: readonly AgencyRef[]) {
  const personal: Dashboard = { kind: "personal", path: "/dashboard" };
  const agencyDashboards: Dashboard[] = agencies.map((a) => ({ kind: "agency", path: `/dashboard/agency/${a.slug}`, agencyId: a.id, agencySlug: a.slug, agencyName: a.name, role: a.role }));
  const preferAgency = accountType === "agency" && agencyDashboards.length > 0;
  return { all: [personal, ...agencyDashboards], default: preferAgency ? agencyDashboards[0]! : personal };
}

/** A person may own a handful of agencies (their own business, a family one) but not an unbounded number. */
export const MAX_OWNED_AGENCIES = 5;
export const canCreateAgency = (ownedCount: number) => ownedCount < MAX_OWNED_AGENCIES;
