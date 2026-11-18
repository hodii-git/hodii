import { describe, expect, it } from "vitest";
import { can, canChangeRole, canEditListing, canInviteRole, canManageLead, canRemoveMember, canViewLead, canCreateAgency, dashboardsFor, statusOnPublish } from "@/lib/access";

const m = (role: "owner" | "admin" | "agent", userId = "u1") => ({ agencyId: "a1", userId, role });

describe("agency roles", () => {
  it("agents work on their own listings and leads only", () => {
    expect(can("agent", "listing.create")).toBe(true);
    expect(can("agent", "listing.edit.any")).toBe(false);
    expect(can("agent", "team.invite")).toBe(false);
    expect(can("agent", "agency.edit")).toBe(false);
    expect(can("agent", "analytics.view.all")).toBe(false);
  });
  it("admins run the agency but cannot delete it or change roles", () => {
    expect(can("admin", "listing.edit.any")).toBe(true);
    expect(can("admin", "lead.view.all")).toBe(true);
    expect(can("admin", "agency.delete")).toBe(false);
    expect(can("admin", "team.change_role")).toBe(false);
  });
  it("owners can do everything", () => {
    expect(can("owner", "agency.delete")).toBe(true);
    expect(can("owner", "team.change_role")).toBe(true);
  });
});

describe("listing and lead access", () => {
  const listing = { agencyId: "a1", createdBy: "u2", agentId: null as string | null };
  it("an agent edits what they created or are assigned to, nothing else", () => {
    expect(canEditListing(m("agent", "u1"), listing)).toBe(false);
    expect(canEditListing(m("agent", "u2"), listing)).toBe(true);
    expect(canEditListing(m("agent", "u1"), { ...listing, agentId: "u1" })).toBe(true);
  });
  it("admins edit any listing of their own agency but never another agency's", () => {
    expect(canEditListing(m("admin"), listing)).toBe(true);
    expect(canEditListing(m("owner"), { ...listing, agencyId: "other" })).toBe(false);
  });
  it("agents see only leads assigned to them", () => {
    const lead = { agencyId: "a1", agentId: "u9", assignedTo: null as string | null };
    expect(canViewLead(m("agent", "u1"), lead)).toBe(false);
    expect(canViewLead(m("agent", "u9"), lead)).toBe(true);
    expect(canManageLead(m("agent", "u1"), { ...lead, assignedTo: "u1" })).toBe(true);
    expect(canViewLead(m("admin"), lead)).toBe(true);
    expect(canViewLead(m("admin"), { ...lead, agencyId: "other" })).toBe(false);
  });
});

describe("team management", () => {
  it("owners remove anyone but owners; admins remove only agents; agents remove nobody", () => {
    expect(canRemoveMember("owner", "admin")).toBe(true);
    expect(canRemoveMember("owner", "owner")).toBe(false);
    expect(canRemoveMember("admin", "agent")).toBe(true);
    expect(canRemoveMember("admin", "admin")).toBe(false);
    expect(canRemoveMember("agent", "agent")).toBe(false);
  });
  it("an agency always keeps one owner", () => {
    expect(canChangeRole("owner", "owner", "admin", 1)).toBe(false);
    expect(canChangeRole("owner", "owner", "admin", 2)).toBe(true);
    expect(canChangeRole("admin", "agent", "admin", 1)).toBe(false);
  });
  it("only owners invite owners", () => {
    expect(canInviteRole("admin", "agent")).toBe(true);
    expect(canInviteRole("admin", "owner")).toBe(false);
    expect(canInviteRole("owner", "owner")).toBe(true);
  });
});

describe("publishing and dashboards", () => {
  it("unverified agencies go through review; verified ones publish at once; suspended ones cannot", () => {
    expect(statusOnPublish({ status: "active", verification: "verified" })).toBe("published");
    expect(statusOnPublish({ status: "active", verification: "unverified" })).toBe("published");
    expect(statusOnPublish({ status: "active", verification: "rejected" })).toBe("published");
    expect(statusOnPublish({ status: "suspended", verification: "verified" })).toBeNull();
  });
  const agencies = [{ id: "a1", slug: "acme-realty", name: "Acme Realty", role: "owner" as const }];
  it("a normal user lands on the personal dashboard", () => {
    const d = dashboardsFor("user", []);
    expect(d.default.kind).toBe("personal");
    expect(d.all).toHaveLength(1);
  });
  it("an agency account lands on its agency dashboard and still has the personal one", () => {
    const d = dashboardsFor("agency", agencies);
    expect(d.default).toMatchObject({ kind: "agency", path: "/dashboard/agency/acme-realty" });
    expect(d.all.map((x) => x.kind)).toEqual(["personal", "agency"]);
  });
  it("a normal user who later creates an agency gets both dashboards but keeps landing on the personal one", () => {
    const d = dashboardsFor("user", agencies);
    expect(d.default.kind).toBe("personal");
    expect(d.all).toHaveLength(2);
  });
  it("limits how many agencies one person can own", () => {
    expect(canCreateAgency(4)).toBe(true);
    expect(canCreateAgency(5)).toBe(false);
  });
});
