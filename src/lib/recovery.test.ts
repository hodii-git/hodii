import { describe, expect, it } from "vitest";
import { generateRecoveryCode, generateRecoveryCodes, normalizeRecoveryCode } from "./recovery";

describe("recovery codes", () => {
  it("makes distinct, well-formed codes", () => {
    const codes = generateRecoveryCodes(8);
    expect(new Set(codes).size).toBe(8);
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
  it("is deterministic for a given random source", () => { expect(generateRecoveryCode(() => new Uint8Array(12))).toBe("AAAA-AAAA-AAAA"); });
  it("accepts typing variations", () => {
    expect(normalizeRecoveryCode("abcd efgh jkmn")).toBe("ABCD-EFGH-JKMN");
    expect(normalizeRecoveryCode("ABCDEFGHJKMN")).toBe("ABCD-EFGH-JKMN");
    expect(normalizeRecoveryCode("short")).toBeNull();
  });
});
