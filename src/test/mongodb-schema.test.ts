import { describe, expect, it } from "vitest";
import { collectionSchemas } from "@/lib/mongodb/schemas";
import { collectionGuards } from "@/lib/mongodb/property-schemas";
import { propertyCollectionIndexes } from "@/lib/mongodb/indexes";
import { findUnsupported, toMongoJsonSchema } from "@/lib/mongodb/validator";

const validators = Object.entries(collectionSchemas).map(([name, schema]) => [name, toMongoJsonSchema(schema, "bson")] as const);

describe("MongoDB validators", () => {
  it.each(validators)("%s uses only keywords MongoDB understands", (_name, schema) => {
    expect(findUnsupported(schema)).toEqual([]);
  });
  it("stores dates as BSON dates", () => {
    const props = toMongoJsonSchema(collectionSchemas.properties, "bson") as { properties: Record<string, unknown> };
    expect(props.properties["createdAt"]).toEqual({ bsonType: "date" });
  });
  it("requires every property field and forbids unknown ones", () => {
    const s = toMongoJsonSchema(collectionSchemas.properties, "bson") as { required: string[]; additionalProperties: boolean };
    expect(s.additionalProperties).toBe(false);
    for (const f of ["agencyId", "slug", "referenceCode", "listingType", "category", "propertyType", "title", "images", "location", "status"]) expect(s.required).toContain(f);
  });
  it("the database itself refuses a published listing without a photo or a price", () => {
    const guard = JSON.stringify(collectionGuards["properties"]);
    expect(guard).toContain('"images.0"');
    expect(guard).toContain('"price.amount"');
    expect(guard).toContain('"status":"draft"');
  });
});

describe("indexes", () => {
  const all = propertyCollectionIndexes;
  it("every indexed collection has a schema", () => {
    for (const name of Object.keys(propertyCollectionIndexes)) expect(collectionSchemas).toHaveProperty(name);
  });
  it("every property collection has indexes", () => {
    for (const name of Object.keys(collectionSchemas)) expect(propertyCollectionIndexes[name]?.length, name).toBeGreaterThan(0);
  });
  it("index names are unique within a collection", () => {
    for (const [name, indexes] of Object.entries(all)) expect(new Set(indexes.map((i) => i.name)).size, name).toBe(indexes.length);
  });
  it("every indexed field exists in the schema", () => {
    for (const [name, indexes] of Object.entries(propertyCollectionIndexes)) {
      const schema = toMongoJsonSchema(collectionSchemas[name as keyof typeof collectionSchemas], "bson");
      for (const index of indexes) for (const field of Object.keys(index.key)) {
        let node: unknown = schema;
        for (const part of field.split(".")) {
          const n = node as { properties?: Record<string, unknown>; anyOf?: { properties?: Record<string, unknown> }[] };
          node = n.properties?.[part] ?? n.anyOf?.find((b) => b.properties?.[part])?.properties?.[part];
          if (node === undefined) break;
        }
        expect(node, `${name}.${field}`).toBeDefined();
      }
    }
  });
  it("keeps raw events and enquiries for 24 months, as the privacy policy says", () => {
    const ttl = (c: string) => propertyCollectionIndexes[c]!.find((i) => i.expireAfterSeconds)?.expireAfterSeconds;
    expect(ttl("enquiries")).toBe(730 * 86_400);
    expect(ttl("propertyEvents")).toBe(730 * 86_400);
  });
  it("makes scraped listings unique per source id without blocking manual listings", () => {
    const dedupe = propertyCollectionIndexes["properties"]!.find((i) => i.name === "source_dedupe")!;
    expect(dedupe.unique).toBe(true);
    expect(dedupe.partialFilterExpression).toEqual({ "source.externalId": { $type: "string" } });
  });
});
