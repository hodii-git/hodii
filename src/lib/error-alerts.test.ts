import { describe, expect, it } from "vitest";
import { ALERT_EVERY_MS, fingerprint, redact, shouldAlert } from "./error-alerts";

describe("redact", () => {
  it("hides emails, phones, tokens and database urls", () => {
    const r = redact("fail for a.b@x.co on 0712345678 Bearer abcdefghijklmnop mongodb+srv://u:p@h/db");
    expect(r).not.toMatch(/a\.b@x\.co|0712345678|abcdefghijklmnop|u:p@h/);
    expect(r).toContain("[email]");
  });
});
describe("fingerprint", () => {
  it("groups errors that differ only by numbers or ids", () => expect(fingerprint("Listing 123 failed", "Error\n    at f (a.ts:10:5)")).toBe(fingerprint("Listing 987 failed", "Error\n    at f (a.ts:10:5)")));
  it("separates different errors", () => expect(fingerprint("Timeout", null)).not.toBe(fingerprint("Bad input", null)));
});
describe("shouldAlert", () => {
  it("alerts when new, then waits an hour", () => {
    const now = Date.now();
    expect(shouldAlert(null, now)).toBe(true);
    expect(shouldAlert(new Date(now - 60_000), now)).toBe(false);
    expect(shouldAlert(new Date(now - ALERT_EVERY_MS - 1), now)).toBe(true);
  });
});
