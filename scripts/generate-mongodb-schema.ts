import { mkdir, writeFile } from "node:fs/promises";
import { collectionSchemas } from "../src/lib/mongodb/schemas";
import { collectionGuards, moderateCollections } from "../src/lib/mongodb/property-schemas";
import { propertyCollectionIndexes } from "../src/lib/mongodb/indexes";
import { toMongoJsonSchema } from "../src/lib/mongodb/validator";

/**
 * Writes mongodb/schema.json: one entry per collection with a ready-to-apply `validator` ({ $jsonSchema, …guards }),
 * its validation level and its indexes. `scripts/apply-mongodb-schema.ts` applies the file to a database.
 *   bun scripts/generate-mongodb-schema.ts
 */
const moderate = new Set<string>(moderateCollections);
const collections: Record<string, unknown> = {};

for (const [name, schema] of Object.entries(collectionSchemas)) {
  collections[name] = {
    group: "property",
    validator: { $jsonSchema: toMongoJsonSchema(schema, "bson"), ...(collectionGuards[name] ?? {}) },
    validationLevel: moderate.has(name) ? "moderate" : "strict", validationAction: "error", indexes: propertyCollectionIndexes[name] ?? [],
  };
}
await mkdir("mongodb", { recursive: true });
await writeFile("mongodb/schema.json", JSON.stringify({ schemaVersion: 2, collections }, null, 2) + "\n");
console.log(`Generated validators and indexes for ${Object.keys(collections).length} collections.`);
