import { describe, expect, test } from "vitest";
import { resolvePlace } from "./places.server";

describe("resolvePlace without a database", () => {
  test("a known estate is not mistaken for a similar county", async () => {
    const r = await resolvePlace(null, "kilimani");
    expect(r?.countyCodes).toEqual([47]);
    expect(r?.q).toBe("Kilimani");
  });
  test("stray words are ignored and the place is found", async () => {
    const r = await resolvePlace(null, "said kilimani");
    expect(r?.q).toBe("Kilimani");
  });
  test("a misspelt county is fixed", async () => {
    expect((await resolvePlace(null, "kimboi"))?.countyCodes).toEqual([22]);
  });
});
