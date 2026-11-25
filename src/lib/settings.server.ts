import { withDb } from "./community.server";
import { SETTINGS, checkValue, crossCheck, merge, type Values } from "./settings-registry";

// Server-only. One document, `appSettings/app`, holds the overrides. Reads are cached for 30 seconds per server instance, so a change
// reaches every instance within half a minute and the database is not asked on every request.
const TTL = 30_000;
let cache: { at: number; values: Values } | null = null;

export async function getSettings(): Promise<Values> {
  if (cache && Date.now() - cache.at < TTL) return cache.values;
  try {
    const doc = await withDb((db) => db.collection("appSettings").findOne({ _id: "app" as never }));
    cache = { at: Date.now(), values: merge((doc?.["values"] as Record<string, unknown> | undefined) ?? null) };
  } catch (e) {
    console.error("settings unavailable, using defaults", e);
    return cache?.values ?? merge(null);
  }
  return cache.values;
}

export const num = async (key: string) => Number((await getSettings())[key]);
export const flag = async (key: string) => (await getSettings())[key] === true;

export type SettingsChange = { key: string; from: number | boolean; to: number | boolean };

/** Saves changed values only. Returns what changed, or an error; nothing is written if any value or combination is invalid. */
export async function saveSettings(patch: Record<string, unknown>): Promise<{ ok: true; changes: SettingsChange[] } | { ok: false; error: string }> {
  const current = await getSettings();
  const next: Values = { ...current };
  const changes: SettingsChange[] = [];
  for (const [k, raw] of Object.entries(patch)) {
    const c = checkValue(k, raw);
    if (!c.ok) return c;
    if (current[k] !== c.value) { changes.push({ key: k, from: current[k]!, to: c.value }); next[k] = c.value; }
  }
  const bad = crossCheck(next);
  if (bad) return { ok: false, error: bad };
  if (!changes.length) return { ok: true, changes };
  const stored: Record<string, number | boolean> = {};
  for (const s of SETTINGS) if (next[s.key] !== s.default) stored[s.key] = next[s.key]!;
  await withDb((db) => db.collection("appSettings").updateOne({ _id: "app" as never }, { $set: { values: stored, updatedAt: new Date() } }, { upsert: true }));
  cache = null;
  return { ok: true, changes };
}
