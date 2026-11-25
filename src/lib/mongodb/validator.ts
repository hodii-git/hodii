import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

/**
 * Converts a Zod schema into a MongoDB `$jsonSchema` validator.
 * MongoDB understands a subset of JSON Schema (bsonType instead of type, no `const`, boolean `exclusiveMinimum`, no `format`),
 * so this translates what Zod emits instead of copying it verbatim.
 *   dates: "bson" → date-time strings become BSON dates (the property model); "iso" → they stay ISO strings (legacy collections).
 */
export type DateMode = "bson" | "iso";
type Json = Record<string, unknown>;

const BSON_BY_TYPE: Record<string, string | string[]> = {
  string: "string", boolean: "bool", array: "array", object: "object", null: "null",
  number: ["double", "int", "long", "decimal"], integer: ["int", "long", "double"],
};
/** Legacy session-style fields stored as BSON dates even though their schema says string. */
const LEGACY_DATE_FIELDS = ["expiresAt", "idleExpiresAt", "lastSeenAt", "revokedAt", "windowStartedAt"];

function unique<T>(values: T[]) { return [...new Set(values)]; }

function convert(node: unknown, field: string, mode: DateMode): unknown {
  if (Array.isArray(node)) return node.map((n) => convert(n, field, mode));
  if (!node || typeof node !== "object") return node;
  const input = node as Json;
  if (field === "_id") return { bsonType: ["objectId", "string"] };

  const types = input["type"] === undefined ? [] : ([] as unknown[]).concat(input["type"]) as string[];
  const isDate = input["format"] === "date-time" && types.includes("string");
  if ((mode === "iso" ? false : isDate) || (mode === "iso" && LEGACY_DATE_FIELDS.includes(field) && types.includes("string"))) {
    return { bsonType: types.includes("null") ? ["date", "null"] : "date" };
  }

  const out: Json = {};
  for (const [key, value] of Object.entries(input)) {
    if (["$schema", "format", "default", "definitions", "$ref", "markdownDescription"].includes(key)) continue;
    if (key === "type") {
      out["bsonType"] = unique(types.flatMap((t) => BSON_BY_TYPE[t] ?? [])).flat();
      if ((out["bsonType"] as string[]).length === 1) out["bsonType"] = (out["bsonType"] as string[])[0];
      if (types.includes("integer")) out["multipleOf"] = 1;
    } else if (key === "const") out["enum"] = [value];
    else if (key === "exclusiveMinimum" && typeof value === "number") { out["minimum"] = value; out["exclusiveMinimum"] = true; }
    else if (key === "exclusiveMaximum" && typeof value === "number") { out["maximum"] = value; out["exclusiveMaximum"] = true; }
    else if (key === "properties") out[key] = Object.fromEntries(Object.entries(value as Json).map(([name, rule]) => [name, convert(rule, name, mode)]));
    else out[key] = convert(value, field, mode);
  }
  return out;
}

export function toMongoJsonSchema(schema: ZodTypeAny, mode: DateMode): Json {
  const raw = zodToJsonSchema(schema, { $refStrategy: "none", target: "jsonSchema7" }) as Json;
  return convert(raw, "", mode) as Json;
}

/** Keywords MongoDB's $jsonSchema does not support. Used by tests to make sure the converter removed them. */
export const UNSUPPORTED_KEYWORDS = ["const", "format", "$schema", "default", "$ref", "type", "propertyNames", "if", "then", "else"] as const;
export function findUnsupported(node: unknown, path = "$"): string[] {
  if (Array.isArray(node)) return node.flatMap((n, i) => findUnsupported(n, `${path}[${i}]`));
  if (!node || typeof node !== "object") return [];
  const found: string[] = [];
  for (const [key, value] of Object.entries(node as Json)) {
    const isPropertyName = path.endsWith(".properties");
    if (!isPropertyName && (UNSUPPORTED_KEYWORDS as readonly string[]).includes(key)) found.push(`${path}.${key}`);
    if (!isPropertyName && (key === "exclusiveMinimum" || key === "exclusiveMaximum") && typeof value !== "boolean") found.push(`${path}.${key}`);
    found.push(...findUnsupported(value, `${path}.${key}`));
  }
  return found;
}
