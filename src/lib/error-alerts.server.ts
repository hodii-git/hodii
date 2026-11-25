import type { Db } from "mongodb";
import { ALERT_EVERY_MS, fingerprint, redact, shouldAlert } from "./error-alerts";
import { ensureCollectionIndexes } from "./mongodb/ensure";

// Server-only. Records errors grouped by fingerprint in `errorEvents` and, when ALERT_WEBHOOK_URL is set, posts a short
// message (Slack, Discord, Teams and most chat tools accept it). Nothing here may throw: reporting a failure must never cause one.

export type ErrorSource = "server" | "browser";
const col = (db: Db) => db.collection("errorEvents");

export async function recordError(db: Db, input: { source: ErrorSource; message: string; stack?: string | null; path?: string | null }) {
  try {
    await ensureCollectionIndexes(db, ["errorEvents"]);
    const message = redact(input.message).slice(0, 300) || "Unknown error";
    const stack = input.stack ? redact(input.stack).slice(0, 2000) : null;
    const key = fingerprint(message, stack);
    const now = new Date();
    const path = input.path ? redact(input.path.split("?")[0] ?? "").slice(0, 200) : null;
    const doc = await col(db).findOneAndUpdate(
      { fingerprint: key },
      { $inc: { count: 1 }, $set: { lastSeen: now, lastPath: path, resolved: false }, $setOnInsert: { _id: crypto.randomUUID() as never, schemaVersion: 1, fingerprint: key, source: input.source, message, stack, firstSeen: now, lastAlertAt: null } },
      { upsert: true, returnDocument: "after" },
    );
    const last = doc?.["lastAlertAt"] instanceof Date ? doc["lastAlertAt"] : null;
    if (!shouldAlert(last, now.getTime())) return;
    await col(db).updateOne({ fingerprint: key, $or: [{ lastAlertAt: null }, { lastAlertAt: { $lte: new Date(now.getTime() - ALERT_EVERY_MS) } }] }, { $set: { lastAlertAt: now } });
    await sendAlert(`Hodii ${input.source} error (${Number(doc?.["count"] ?? 1)}×): ${message}${path ? ` on ${path}` : ""}`);
  } catch (e) { console.warn("recordError failed", e instanceof Error ? e.message : e); }
}

async function sendAlert(text: string) {
  const url = process.env["ALERT_WEBHOOK_URL"];
  if (!url || !/^https:\/\//.test(url)) return;
  try {
    await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(3000) });
  } catch { /* the alert channel being down is not worth a second failure */ }
}

/** From server.ts, where an error has no database handle of its own. */
export async function recordServerError(error: unknown, path: string | null) {
  try {
    const { withDb } = await import("./community.server");
    const e = error instanceof Error ? error : new Error(String(error));
    // A visitor closing the tab or typing on (which cancels the earlier search) aborts the request. That is not a fault of the site.
    if (e.name === "AbortError" || /^(aborted|This operation was aborted)$/.test(e.message)) return;
    await withDb((db) => recordError(db, { source: "server", message: e.message, stack: e.stack ?? null, path }));
  } catch { /* the database may be the very thing that is down */ }
}

export async function listErrors(db: Db, limit = 100) {
  const rows = await col(db).find({}).sort({ lastSeen: -1 }).limit(limit).toArray();
  return rows.map((r) => ({ id: String(r["_id"]), source: String(r["source"]), message: String(r["message"]), stack: typeof r["stack"] === "string" ? r["stack"] : null, count: Number(r["count"] ?? 1), path: typeof r["lastPath"] === "string" ? r["lastPath"] : null, firstSeen: (r["firstSeen"] as Date).toISOString(), lastSeen: (r["lastSeen"] as Date).toISOString(), resolved: !!r["resolved"] }));
}
export const resolveError = (db: Db, id: string) => col(db).updateOne({ _id: id as never }, { $set: { resolved: true } });
