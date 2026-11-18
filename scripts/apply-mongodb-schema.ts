import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";

/**
 * Applies mongodb/schema.json to a database: creates each collection with its validator (or updates the validator on an
 * existing one) and creates its indexes. It never deletes data, and re-running it is safe.
 *
 *   MONGODB_URI=… MONGODB_DB=hodii bun scripts/apply-mongodb-schema.ts [--dry-run]
 *
 * Existing documents are not re-checked: the validator applies to future inserts and updates. Run it against a copy first.
 */
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const uri = process.env["MONGODB_URI"];
if (!uri) throw new Error("Set MONGODB_URI");
const dbName = process.env["MONGODB_DB"]?.trim() || "hodii";

type Index = { name: string; key: Record<string, 1 | -1 | "text" | "2dsphere">; unique?: boolean; expireAfterSeconds?: number; partialFilterExpression?: object; weights?: object; default_language?: string };
type Entry = { group: string; validator: object; validationLevel: string; validationAction: string; indexes: Index[] };
const file = JSON.parse(await readFile("mongodb/schema.json", "utf8")) as { collections: Record<string, Entry> };

const client = await new MongoClient(uri).connect();
try {
  const db = client.db(dbName);
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  console.log(`${dryRun ? "[dry run] " : ""}Applying to database "${dbName}"`);
  for (const [name, entry] of Object.entries(file.collections)) {
    const opts = { validator: entry.validator, validationLevel: entry.validationLevel, validationAction: entry.validationAction };
    console.log(`- ${name}: ${existing.has(name) ? "update validator" : "create"}, ${entry.indexes.length} indexes`);
    if (dryRun) continue;
    if (existing.has(name)) await db.command({ collMod: name, ...opts });
    else await db.createCollection(name, opts as never);
    for (const { key, ...options } of entry.indexes) await db.collection(name).createIndex(key, options);
  }
} finally {
  await client.close();
}
