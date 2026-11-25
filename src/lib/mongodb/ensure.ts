import type { Db } from "mongodb";
import { propertyCollectionIndexes } from "./indexes";

/**
 * Creates the declared indexes of the named collections once per server instance, the first time they are used.
 * `scripts/apply-mongodb-schema.ts` is the full installer (validators and every index); this keeps a fresh
 * deployment correct for the collections a request touches even before that script has been run.
 */
const done = new Set<string>();
export async function ensureCollectionIndexes(db: Db, names: readonly string[]) {
  await Promise.all(names.filter((n) => !done.has(n)).map(async (name) => {
    for (const { key, ...options } of propertyCollectionIndexes[name] ?? []) await db.collection(name).createIndex(key, options);
    done.add(name);
  }));
}
