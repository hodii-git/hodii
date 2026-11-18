import { describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import { agenciesOfUser, createAgency, createAgencyInput } from "@/lib/agency.server";

/** A tiny in-memory stand-in for the three collection calls the agency code makes. */
function fakeDb(opts: { failMembers?: boolean } = {}) {
  const data: Record<string, Record<string, unknown>[]> = { agencies: [], agencyMembers: [] };
  const match = (doc: Record<string, unknown>, q: Record<string, unknown>) =>
    Object.entries(q).every(([k, v]) => (v && typeof v === "object" && "$in" in v ? (v as { $in: unknown[] }).$in.includes(doc[k]) : doc[k] === v));
  const collection = (name: string) => ({
    createIndex: async () => "ok",
    insertOne: async (doc: Record<string, unknown>) => {
      if (opts.failMembers && name === "agencyMembers") throw new Error("boom");
      if (name === "agencies" && data["agencies"]!.some((a) => a["slug"] === doc["slug"])) throw Object.assign(new Error("dup"), { code: 11000 });
      data[name]!.push(doc);
    },
    countDocuments: async (q: Record<string, unknown>) => data[name]!.filter((d) => match(d, q)).length,
    deleteOne: async (q: Record<string, unknown>) => { const i = data[name]!.findIndex((d) => match(d, q)); if (i >= 0) data[name]!.splice(i, 1); },
    find: (q: Record<string, unknown>) => ({ limit: () => ({ toArray: async () => data[name]!.filter((d) => match(d, q)) }), toArray: async () => data[name]!.filter((d) => match(d, q)) }),
  });
  return { db: { collection } as unknown as Db, data };
}
const input = createAgencyInput.parse({ name: "Acme Realty", phone: "0712 345 678", kind: "estate_agency", countyCode: 47 });

describe("creating an agency", () => {
  it("validates the form: a name and a Kenyan phone number", () => {
    expect(input.phone).toBe("+254712345678");
    expect(createAgencyInput.safeParse({ name: "A", phone: "0712345678" }).success).toBe(false);
    expect(createAgencyInput.safeParse({ name: "Acme", phone: "123" }).success).toBe(false);
    expect(createAgencyInput.parse({ name: "Acme", phone: "0712345678" })).toMatchObject({ kind: "estate_agency", countyCode: null });
  });
  it("creates the agency with the creator as its owner", async () => {
    const { db, data } = fakeDb();
    const out = await createAgency(db, { id: "u1", email: "Owner@Acme.co.ke" }, input);
    expect(out.slug).toBe("acme-realty");
    expect(data["agencies"]![0]).toMatchObject({ name: "Acme Realty", status: "active", createdBy: "u1", contact: { email: "owner@acme.co.ke", phone: "+254712345678" }, verification: { status: "unverified" } });
    expect(data["agencyMembers"]![0]).toMatchObject({ agencyId: out.id, userId: "u1", role: "owner", status: "active" });
  });
  it("gives a second agency with the same name a different slug", async () => {
    const { db } = fakeDb();
    const a = await createAgency(db, { id: "u1", email: "a@x.co.ke" }, input);
    const b = await createAgency(db, { id: "u2", email: "b@x.co.ke" }, input);
    expect(a.slug).toBe("acme-realty");
    expect(b.slug).toMatch(/^acme-realty-[a-z0-9]{3}$/);
  });
  it("limits how many agencies one person owns", async () => {
    const { db } = fakeDb();
    for (let i = 0; i < 5; i++) await createAgency(db, { id: "u1", email: "a@x.co.ke" }, { ...input, name: `Agency ${i}` });
    await expect(createAgency(db, { id: "u1", email: "a@x.co.ke" }, { ...input, name: "One too many" })).rejects.toThrow(/up to 5/);
  });
  it("never leaves an agency without an owner", async () => {
    const { db, data } = fakeDb({ failMembers: true });
    await expect(createAgency(db, { id: "u1", email: "a@x.co.ke" }, input)).rejects.toThrow("boom");
    expect(data["agencies"]).toHaveLength(0);
  });
  it("lists a person's agencies with their role", async () => {
    const { db } = fakeDb();
    const a = await createAgency(db, { id: "u1", email: "a@x.co.ke" }, input);
    expect(await agenciesOfUser(db, "u1")).toEqual([{ id: a.id, slug: "acme-realty", name: "Acme Realty", role: "owner" }]);
    expect(await agenciesOfUser(db, "someone-else")).toEqual([]);
  });
});
