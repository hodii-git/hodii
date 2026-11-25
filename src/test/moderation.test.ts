import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));

import { decideAgency, decideListing, decideOnListing, decideOnReport } from "@/lib/moderation.server";
import { addMemberInput, agencyProfileInput, enquiryUpdate, listingFilter, statusChange } from "@/lib/dashboard.server";

describe("moderation inputs", () => {
  it("approving needs no reason, rejecting does", () => {
    expect(decideListing.safeParse({ id: "p1", decision: "approve" }).success).toBe(true);
    expect(decideListing.safeParse({ id: "p1", decision: "reject" }).success).toBe(false);
    expect(decideListing.safeParse({ id: "p1", decision: "reject", reason: "no" }).success).toBe(false);
    expect(decideListing.safeParse({ id: "p1", decision: "reject", reason: "Photos do not match the property" }).success).toBe(true);
  });
  it("rejecting an agency needs a reason", () => {
    expect(decideAgency.safeParse({ id: "a1", decision: "verify" }).success).toBe(true);
    expect(decideAgency.safeParse({ id: "a1", decision: "reject" }).success).toBe(false);
  });
});

/** A tiny in-memory stand-in for the parts of the driver these decisions use. */
function fakeDb(docs: Record<string, Record<string, unknown>[]>) {
  const matches = (d: Record<string, unknown>, q: Record<string, unknown>) => Object.entries(q).every(([k, v]) => (v && typeof v === "object" && "$in" in v ? (v as { $in: unknown[] }).$in.includes(d[k]) : d[k] === v));
  const updates: { col: string; q: Record<string, unknown>; set: Record<string, unknown>; many: boolean }[] = [];
  return { updates, db: { collection: (name: string) => ({
    findOne: async (q: Record<string, unknown>) => (docs[name] ?? []).find((d) => matches(d, q)) ?? null,
    updateOne: async (q: Record<string, unknown>, u: { $set: Record<string, unknown> }) => { updates.push({ col: name, q, set: u.$set, many: false }); },
    updateMany: async (q: Record<string, unknown>, u: { $set: Record<string, unknown> }) => { updates.push({ col: name, q, set: u.$set, many: true }); },
  }) } as never };
}

describe("deciding on a listing", () => {
  it("refuses a listing that is not waiting", async () => {
    const { db } = fakeDb({ properties: [] });
    await expect(decideOnListing(db, { id: "admin" }, { id: "p1", decision: "approve" })).rejects.toThrow(/no longer waiting/);
  });
  it("records why a listing was rejected", async () => {
    const { db, updates } = fakeDb({ properties: [{ _id: "p1", status: "pending_review" }] });
    await decideOnListing(db, { id: "admin" }, { id: "p1", decision: "reject", reason: "Photos do not match" });
    expect(updates[0]?.set).toMatchObject({ status: "rejected", moderation: { reviewedBy: "admin", rejectionReason: "Photos do not match" } });
  });
});

describe("deciding on a report", () => {
  it("pausing settles every open report on the same listing", async () => {
    const { db, updates } = fakeDb({ listingReports: [{ _id: "r1", propertyId: "p1", status: "open" }] });
    await decideOnReport(db, { id: "admin" }, { id: "r1", decision: "pause_listing" });
    expect(updates.find((u) => u.col === "properties")?.set).toMatchObject({ status: "paused" });
    const settle = updates.find((u) => u.col === "listingReports");
    expect(settle?.many).toBe(true);
    expect(settle?.set).toMatchObject({ status: "actioned", handledBy: "admin" });
  });
  it("dismissing leaves the listing alone", async () => {
    const { db, updates } = fakeDb({ listingReports: [{ _id: "r1", propertyId: "p1", status: "open" }] });
    await decideOnReport(db, { id: "admin" }, { id: "r1", decision: "dismiss" });
    expect(updates.some((u) => u.col === "properties")).toBe(false);
    expect(updates[0]?.set).toMatchObject({ status: "dismissed" });
  });
  it("refuses a report that was already handled", async () => {
    const { db } = fakeDb({ listingReports: [] });
    await expect(decideOnReport(db, { id: "admin" }, { id: "r9", decision: "dismiss" })).rejects.toThrow(/already handled/);
  });
});

describe("dashboard inputs", () => {
  it("closing a listing carries a reason the UI supplies", () => {
    expect(statusChange.safeParse({ id: "p1", to: "closed", reason: "let" }).success).toBe(true);
    expect(statusChange.safeParse({ id: "p1", to: "deleted" }).success).toBe(false);
  });
  it("only admins and agents can be added, never owners", () => {
    expect(addMemberInput.safeParse({ email: "a@b.co", role: "agent" }).success).toBe(true);
    expect(addMemberInput.safeParse({ email: "a@b.co", role: "owner" }).success).toBe(false);
  });
  it("agency links must be https", () => {
    const base = { name: "Acme Homes", description: "", phone: "0712345678", whatsapp: null, email: "a@b.co", website: null, countyCode: 47, area: null, serviceAreas: [], earbNumber: null, businessRegNumber: null, logoUrl: null };
    expect(agencyProfileInput.safeParse(base).success).toBe(true);
    expect(agencyProfileInput.safeParse({ ...base, website: "http://acme.co.ke" }).success).toBe(false);
  });
  it("list filters default to page one", () => {
    expect(listingFilter.parse({}).page).toBe(1);
    expect(listingFilter.safeParse({ page: 0 }).success).toBe(false);
  });
  it("enquiry updates need an id", () => {
    expect(enquiryUpdate.safeParse({ status: "won" }).success).toBe(false);
    expect(enquiryUpdate.safeParse({ id: "e1", status: "won" }).success).toBe(true);
  });
});
