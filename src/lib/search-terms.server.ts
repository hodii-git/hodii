import type { Db } from "mongodb";
import { z } from "zod";
import { ensureCollectionIndexes } from "./mongodb/ensure";

let ready: Promise<unknown> | null = null;

/** The words worth counting: not a reference code, number, email or very short fragment. */
export function termOf(q: string | undefined | null): string | null {
  const t = (q ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);
  if (t.length < 3 || /@|^\+?[\d\s-]{6,}$/.test(t) || /^hd-[a-z0-9]{6}$/.test(t)) return null;
  return t;
}
const dayOf = (d = new Date()) => new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

/** Counts a search by its words only. Never throws: the search must not fail because the log did. */
export async function logSearch(db: Db, q: string | undefined, total: number, closeMatch: boolean) {
  const term = termOf(q);
  if (!term) return;
  try {
    ready ??= ensureCollectionIndexes(db, ["searchTerms"]);
    await ready;
    const day = dayOf(), now = new Date();
    await db.collection("searchTerms").updateOne({ _id: `${day}:${term}` as never }, {
      $inc: { searches: 1, zero: total === 0 ? 1 : 0, closeMatch: closeMatch ? 1 : 0 },
      $set: { updatedAt: now },
      $setOnInsert: { schemaVersion: 1, day, term },
    }, { upsert: true });
  } catch { ready = null; }
}

export const searchReportInput = z.object({ days: z.number().int().min(1).max(120).default(30) });

export async function searchReport(db: Db, days: number) {
  const since = dayOf(new Date(Date.now() - days * 86_400_000));
  const grouped = await db.collection("searchTerms").aggregate([
    { $match: { day: { $gte: since } } },
    { $group: { _id: "$term", searches: { $sum: "$searches" }, zero: { $sum: "$zero" }, closeMatch: { $sum: "$closeMatch" } } },
  ]).toArray();
  const rows = grouped.map((g) => ({ term: String(g["_id"]), searches: Number(g["searches"]), zero: Number(g["zero"]), closeMatch: Number(g["closeMatch"]) }));
  const total = rows.reduce((n, r) => n + r.searches, 0), zero = rows.reduce((n, r) => n + r.zero, 0);
  return {
    total, zero, zeroPct: total ? Math.round((zero / total) * 100) : 0,
    top: [...rows].sort((a, b) => b.searches - a.searches).slice(0, 15),
    noResults: rows.filter((r) => r.zero > 0).sort((a, b) => b.zero - a.zero).slice(0, 15),
  };
}
