import type { Db } from "mongodb";
import { z } from "zod";
import { can, canEditListing } from "./access";
import { adjustAmount, deletePhrase, MAX_BULK, phraseMatches } from "./bulk-rules";
import { TEMPLATE_HEADERS, planImport } from "./bulk-import";
import { parseCsvRecords, toCsv } from "./csv";
import { DashboardError, changeListingStatus, confirmListing, deleteListing, fail, loadOwned, saveListing, type Member } from "./dashboard.server";
import { propertiesCol } from "./properties.server";
import { toKes } from "./mongodb/limits";
import { CLOSED_REASONS } from "./mongodb/taxonomy";

// Server-only: CSV import and actions on many listings at once. Each listing is checked on its own, so one that cannot be changed
// is reported and skipped without stopping the rest.

export const importInput = z.object({ text: z.string().min(1).max(1_500_000) });

/** Saves every valid row as a draft. The file is read again here: nothing from the browser's preview is trusted. */
export async function commitImport(db: Db, m: Member, text: string) {
  if (!can(m, "listing.create")) return fail("You do not have permission to add listings");
  const { headers, records } = parseCsvRecords(text);
  const plan = planImport(headers, records);
  if (plan.headerProblems.some((p) => p.startsWith("Missing"))) return fail(plan.headerProblems[0]!);
  const results: { row: number; title: string; ok: boolean; referenceCode?: string; id?: string; error?: string }[] = [];
  for (const r of plan.rows) {
    if (!r.ok || !r.form) { results.push({ row: r.row, title: r.title, ok: false, error: r.errors[0] ?? "Could not be read" }); continue; }
    try {
      const out = await saveListing(db, m, null, r.form, "draft");
      if (out.ok) results.push({ row: r.row, title: r.title, ok: true, referenceCode: out.referenceCode, id: out.id });
      else results.push({ row: r.row, title: r.title, ok: false, error: out.issues[0]?.message ?? "Could not be saved" });
    } catch (e) {
      if (e instanceof DashboardError) { results.push({ row: r.row, title: r.title, ok: false, error: e.message }); if (/limit/.test(e.message)) break; continue; }
      throw e;
    }
  }
  return { created: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results, tooMany: plan.tooMany };
}

export const bulkInput = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(MAX_BULK),
  action: z.enum(["pause", "resume", "renew", "close", "price_percent", "assign_agent", "delete"]),
  reason: z.enum(CLOSED_REASONS).optional(), percent: z.number().min(-50).max(100).optional(), agentId: z.string().max(64).nullable().optional(),
  /** Deleting needs the phrase typed in full, and for several listings the person's password as well. */
  confirmText: z.string().max(40).optional(), password: z.string().max(200).optional(),
});
export type BulkInput = z.infer<typeof bulkInput>;
export type BulkResult = { done: number; skipped: { id: string; ref: string; reason: string }[] };

export async function bulkAction(db: Db, m: Member, input: BulkInput, checkPassword: (pw: string) => Promise<boolean>): Promise<BulkResult> {
  const ids = [...new Set(input.ids)];
  if (input.action === "delete") {
    // Look the listings up first so the phrase for a single listing can be its reference code.
    const first = ids.length === 1 ? await loadOwned(db, m, ids[0]!).catch(() => null) : null;
    if (!input.confirmText || !phraseMatches(input.confirmText, deletePhrase(ids.length, first?.referenceCode))) return fail(ids.length === 1 ? "Type the listing's reference code to confirm" : `Type DELETE ${ids.length} to confirm`);
    if (ids.length > 1 && !(input.password && (await checkPassword(input.password)))) return fail("Your password is needed to delete several listings, and it was not right");
  }
  if (input.action === "assign_agent" && !can(m, "listing.assign")) return fail("Only admins can assign listings to other agents");
  if (input.action === "price_percent" && adjustAmount(100_000, input.percent ?? 0) === null) return fail("Enter a price change between -50% and +100%, not zero");
  if (input.action === "close" && !input.reason) return fail("Say whether the properties were sold, let or withdrawn");
  if (input.action === "assign_agent" && input.agentId && !(await db.collection("agencyMembers").findOne({ agencyId: m.agencyId, userId: input.agentId, status: "active" }, { projection: { _id: 1 } }))) return fail("That agent is not on your team");

  const out: BulkResult = { done: 0, skipped: [] };
  for (const id of ids) {
    let ref = id;
    try {
      const p = await loadOwned(db, m, id);
      ref = p.referenceCode;
      if (!canEditListing(m, p)) throw new DashboardError("Not your listing");
      switch (input.action) {
        case "pause": await changeListingStatus(db, m, { id, to: "paused" }); break;
        case "resume": await changeListingStatus(db, m, { id, to: "published" }); break;
        case "renew": await confirmListing(db, m, id); break;
        case "close": await changeListingStatus(db, m, { id, to: "closed", reason: input.reason! }); break;
        case "delete": await deleteListing(db, m, id); break;
        case "assign_agent": await propertiesCol(db).updateOne({ _id: p._id }, { $set: { agentId: input.agentId ?? null, updatedAt: new Date() } } as never); break;
        case "price_percent": {
          if (!p.price) throw new DashboardError("No price set");
          const amount = adjustAmount(p.price.amount, input.percent!);
          if (amount === null) throw new DashboardError("The new price is out of range");
          const now = new Date();
          const usd = Number(process.env["USD_TO_KES"]);
          await propertiesCol(db).updateOne({ _id: p._id }, { $set: { "price.amount": amount, "price.amountKes": toKes(amount, p.price.currency, Number.isFinite(usd) && usd > 0 ? usd : undefined), updatedAt: now }, $push: { priceHistory: { $each: [{ amount: p.price.amount, changedAt: now }], $slice: -20 } } } as never);
          break;
        }
      }
      out.done++;
    } catch (e) {
      if (e instanceof DashboardError) out.skipped.push({ id, ref, reason: e.message }); else throw e;
    }
  }
  return out;
}

const HEAD = ["reference", "status", ...TEMPLATE_HEADERS];
/** Every listing the agency has, in the same columns the import reads, so a file can be edited in a spreadsheet and re-imported as new drafts. */
export async function exportListingsCsv(db: Db, m: Member) {
  const filter = can(m, "analytics.view.all") ? { agencyId: m.agencyId } : { agencyId: m.agencyId, $or: [{ createdBy: m.userId }, { agentId: m.userId }] };
  const rows = await propertiesCol(db).find(filter as never).sort({ updatedAt: -1 }).limit(5000).toArray();
  return toCsv([HEAD, ...rows.map((p) => [
    p.referenceCode, p.status, p.title, p.description, p.listingType, p.propertyType, p.price?.amount ?? "", p.price?.currency ?? "", p.price?.period ?? "", p.price?.negotiable ? "yes" : "no",
    p.location.county ?? "", p.location.areaName, p.location.address ?? "", p.location.landmark ?? "", p.location.point?.coordinates[1] ?? "", p.location.point?.coordinates[0] ?? "", p.location.hideExactLocation ? "yes" : "no",
    p.details.bedrooms ?? "", p.details.bathrooms ?? "", p.details.parkingSpaces ?? "", p.details.floorAreaSqm ?? "", p.details.plotAreaValue ?? "", p.details.plotAreaUnit ?? "", p.features.join("; "), p.highlights.join("; "), p.externalRef ?? "", p.contactPhone ?? "",
  ])]);
}
