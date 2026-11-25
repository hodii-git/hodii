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
/** Every action there is, for checking what an admin tries to grant. */
export const ALL_ACTIONS: readonly Action[] = [...new Set([...OWNER])];
/** Actions only an owner has, never handed to anyone else one by one. */
export const OWNER_ONLY: readonly Action[] = ["team.change_role", "agency.delete"];

/**
 * Who is being asked about: a bare role (its default rights), or a member who may carry their own list.
 * A custom list replaces the role's defaults, and everyone can always see the team. Owners always have everything.
 */
export type Subject = MemberRole | { role: MemberRole; permissions?: readonly string[] | null | undefined };
export const roleOf = (s: Subject): MemberRole => (typeof s === "string" ? s : s.role);
export function actionsOf(s: Subject): readonly Action[] {
  if (typeof s === "string" || s.role === "owner" || !s.permissions) return ROLE_ACTIONS[roleOf(s)];
  const own = s.permissions.filter((p): p is Action => (ALL_ACTIONS as readonly string[]).includes(p) && !OWNER_ONLY.includes(p as Action));
  return [...new Set<Action>([...own, "team.view"])];
}
export const can = (s: Subject, action: Action) => actionsOf(s).includes(action);

/** The permission list an admin may hand out: known actions the giver has, never owner-only ones, always including seeing the team. */
export function grantable(giver: Subject, wanted: readonly string[]): Action[] {
  const mine = actionsOf(giver);
  return [...new Set(wanted)].filter((a): a is Action => (ALL_ACTIONS as readonly string[]).includes(a) && !OWNER_ONLY.includes(a as Action) && mine.includes(a as Action));
}

export type Membership = { agencyId: string; userId: string; role: MemberRole; permissions?: readonly string[] | null };

export function canEditListing(m: Membership, listing: { agencyId: string; createdBy: string; agentId: string | null }) {
  if (m.agencyId !== listing.agencyId) return false;
  if (can(m, "listing.edit.any")) return true;
  return can(m, "listing.edit.own") && (listing.createdBy === m.userId || listing.agentId === m.userId);
}

export function canViewLead(m: Membership, lead: { agencyId: string; agentId: string | null; assignedTo: string | null }) {
  if (m.agencyId !== lead.agencyId) return false;
  if (can(m, "lead.view.all")) return true;
  return can(m, "lead.view.assigned") && (lead.agentId === m.userId || lead.assignedTo === m.userId);
}

export function canManageLead(m: Membership, lead: { agencyId: string; agentId: string | null; assignedTo: string | null }) {
  if (!canViewLead(m, lead)) return false;
  return can(m, "lead.manage.all") || can(m, "lead.manage.assigned");
}

/** Owners can remove anyone; admins can remove agents only. Nobody removes an owner through this check: owners are demoted or the agency is deleted. */
export function canRemoveMember(actor: Subject, target: MemberRole) {
  if (!can(actor, "team.remove")) return false;
  if (roleOf(actor) === "owner") return target !== "owner";
  return target === "agent";
}
/** Only owners change roles, and an agency always keeps at least one owner. */
export function canChangeRole(actor: Subject, target: MemberRole, next: MemberRole, ownerCount: number) {
  if (!can(actor, "team.change_role")) return false;
  if (target === "owner" && next !== "owner" && ownerCount <= 1) return false;
  return true;
}
/** Admins can invite agents and other admins; only owners can invite owners. */
export const canInviteRole = (actor: Subject, role: MemberRole) => can(actor, "team.invite") && (role !== "owner" || roleOf(actor) === "owner");
/** Owners shape anyone but owners; admins shape agents only. */
export const canShapeMember = (actor: Subject, target: MemberRole) => can(actor, "team.invite") && target !== "owner" && (roleOf(actor) === "owner" || target === "agent");

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
