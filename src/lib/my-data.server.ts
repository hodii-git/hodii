import type { Db } from "mongodb";
import { decrypt } from "./community.server";

// Server-only: everything we hold that belongs to one person, as plain data (Data Protection Act, 2019: right of access).
// Never included: the password hash, recovery code digests, session tokens and network hashes.

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);
const plain = (v: unknown) => (typeof v === "string" ? v : null);

export async function collectMyData(db: Db, userId: string) {
  const u = await db.collection("users").findOne({ _id: userId as never });
  if (!u) throw new Error("Account not found");
  const [saved, searches, enquiries, reviews, comments, memberships, nbReviews, nbPosts] = await Promise.all([
    db.collection("savedProperties").find({ userId }).limit(1000).toArray(),
    db.collection("savedSearches").find({ userId }).limit(100).toArray(),
    db.collection("enquiries").find({ userId }).sort({ createdAt: -1 }).limit(1000).toArray(),
    db.collection("agencyReviews").find({ userId }).limit(500).toArray(),
    db.collection("propertyComments").find({ userId, deletedAt: null }).limit(2000).toArray(),
    db.collection("agencyMembers").find({ userId, status: { $in: ["active", "invited"] } }).limit(100).toArray(),
    db.collection("neighbourhoodReviews").find({ userId }).limit(500).toArray(),
    db.collection("neighbourhoodPosts").find({ userId, deletedAt: null }).limit(2000).toArray(),
  ]);
  const threads = enquiries.length ? await db.collection("enquiryMessages").find({ enquiryId: { $in: enquiries.map((e) => String(e["_id"])) } }).sort({ createdAt: 1 }).limit(5000).toArray() : [];
  const agencyIds = [...new Set([...memberships.map((m) => String(m["agencyId"])), ...reviews.map((r) => String(r["agencyId"]))])];
  const agencies = agencyIds.length ? await db.collection("agencies").find({ _id: { $in: agencyIds as never } }, { projection: { name: 1, slug: 1 } }).toArray() : [];
  const agencyName = new Map(agencies.map((a) => [String(a._id), String(a["name"])]));
  const propIds = [...new Set(saved.map((s) => String(s["propertyId"])))];
  const props = propIds.length ? await db.collection("properties").find({ _id: { $in: propIds as never } }, { projection: { referenceCode: 1, title: 1, slug: 1 } }).toArray() : [];
  const prop = new Map(props.map((p) => [String(p._id), p]));

  return {
    exportedAt: new Date().toISOString(),
    about: "A copy of the personal data Hodii holds about you. Passwords and recovery codes are stored only as one-way hashes and are not included.",
    account: {
      username: plain(u["username"]), email: await decrypt(plain(u["emailEnc"])), phone: u["phoneEnc"] ? await decrypt(plain(u["phoneEnc"])) : null,
      accountType: plain(u["accountType"]) ?? "user", createdAt: iso(u["createdAt"]), lastSignInAt: iso(u["lastSignInAt"]),
      termsAcceptedAt: iso(u["termsAcceptedAt"]), termsVersion: plain(u["termsVersion"]), profilePicture: (u["avatar"] as { url?: string } | null | undefined)?.url ?? null,
    },
    agencyMemberships: memberships.map((m) => ({ agency: agencyName.get(String(m["agencyId"])) ?? null, role: plain(m["role"]), status: plain(m["status"]), since: iso(m["createdAt"]) })),
    savedProperties: saved.map((s) => { const p = prop.get(String(s["propertyId"])); return { reference: p ? plain(p["referenceCode"]) : null, title: p ? plain(p["title"]) : null, priceWhenSaved: s["priceAtSave"] ?? null, savedAt: iso(s["createdAt"]) }; }),
    savedSearches: searches.map((s) => ({ name: plain(s["name"]), criteria: s["criteria"], frequency: plain(s["frequency"]), createdAt: iso(s["createdAt"]) })),
    enquiries: await Promise.all(enquiries.map(async (e) => ({
      property: plain(e["propertyTitle"]), reference: plain(e["propertyRef"]), name: plain(e["name"]), email: await decrypt(plain(e["emailEnc"])), phone: e["phoneEnc"] ? await decrypt(plain(e["phoneEnc"])) : null,
      message: plain(e["message"]), status: plain(e["status"]), sentAt: iso(e["createdAt"]),
      conversation: threads.filter((t) => t["enquiryId"] === String(e["_id"])).map((t) => ({ from: t["senderRole"] === "agent" ? "agency" : "you", message: plain(t["body"]), at: iso(t["createdAt"]) })),
    }))),
    reviews: reviews.map((r) => ({ agency: agencyName.get(String(r["agencyId"])) ?? null, rating: r["rating"], text: plain(r["body"]), at: iso(r["createdAt"]) })),
    neighbourhoodReviews: await Promise.all(nbReviews.map(async (r) => ({ area: plain(r["areaKey"]), ratings: r["ratings"], relation: plain(r["relation"]), text: r["textEnc"] ? await decrypt(plain(r["textEnc"])) : null, at: iso(r["updatedAt"]) }))),
    neighbourhoodChat: await Promise.all(nbPosts.map(async (c) => ({ area: plain(c["areaKey"]), text: await decrypt(plain(c["textEnc"])), at: iso(c["createdAt"]) }))),
    comments: await Promise.all(comments.map(async (c) => ({ text: await decrypt(plain(c["textEnc"])), at: iso(c["createdAt"]) }))),
  };
}
