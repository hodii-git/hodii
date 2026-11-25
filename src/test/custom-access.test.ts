import { describe, expect, it } from "vitest";
import { actionsOf, can, canShapeMember, grantable } from "@/lib/access";

describe("custom access", () => {
  const agentWith = (permissions: string[]) => ({ role: "agent" as const, permissions });
  it("a custom list replaces the role defaults and always keeps team.view", () => {
    const s = agentWith(["lead.view.all"]);
    expect(can(s, "lead.view.all")).toBe(true);
    expect(can(s, "listing.create")).toBe(false);
    expect(can(s, "team.view")).toBe(true);
  });
  it("no list means the role defaults", () => {
    expect(actionsOf({ role: "agent", permissions: null })).toEqual(actionsOf("agent"));
  });
  it("owners always keep everything", () => {
    expect(can({ role: "owner", permissions: [] }, "agency.delete")).toBe(true);
  });
  it("owner-only and unknown actions are never handed out", () => {
    expect(grantable("owner", ["agency.delete", "team.change_role", "nonsense", "listing.create"])).toEqual(["listing.create"]);
    expect(can(agentWith(["agency.delete", "team.change_role"]), "agency.delete")).toBe(false);
  });
  it("an admin cannot give away what they do not have", () => {
    const g = { role: "admin" as const, permissions: ["listing.create", "team.invite"] };
    expect(grantable(g, ["listing.create", "billing.manage"])).toEqual(["listing.create"]);
  });
  it("owners shape admins and agents; admins shape agents only; nobody shapes owners", () => {
    expect(canShapeMember("owner", "admin")).toBe(true);
    expect(canShapeMember("admin", "agent")).toBe(true);
    expect(canShapeMember("admin", "admin")).toBe(false);
    expect(canShapeMember("owner", "owner")).toBe(false);
    expect(canShapeMember("agent", "agent")).toBe(false);
  });
});
