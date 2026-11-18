import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, otpauthUri, totpAt, verifyTotp } from "./totp";

// RFC 6238 appendix B: secret "12345678901234567890" in base32; 8-digit codes at these times.
const SECRET = base32Encode(new TextEncoder().encode("12345678901234567890"));
describe("totp", () => {
  it("round-trips base32", () => expect(new TextDecoder().decode(base32Decode(SECRET))).toBe("12345678901234567890"));
  it("matches the RFC 6238 test vectors", async () => {
    expect(await totpAt(SECRET, Math.floor(59 / 30), 8)).toBe("94287082");
    expect(await totpAt(SECRET, Math.floor(1111111109 / 30), 8)).toBe("07081804");
    expect(await totpAt(SECRET, Math.floor(20000000000 / 30), 8)).toBe("65353130");
  });
  it("accepts the current and neighbouring steps, and nothing else", async () => {
    const t = 1_700_000_000_000;
    const step = Math.floor(t / 1000 / 30);
    const code = await totpAt(SECRET, step);
    expect(await verifyTotp(SECRET, code, t)).toBe(step);
    expect(await verifyTotp(SECRET, await totpAt(SECRET, step - 1), t)).toBe(step - 1);
    expect(await verifyTotp(SECRET, await totpAt(SECRET, step - 3), t)).toBeNull();
    expect(await verifyTotp(SECRET, "12345", t)).toBeNull();
    expect(await verifyTotp(SECRET, "abcdef", t)).toBeNull();
  });
  it("builds an otpauth link", () => expect(otpauthUri("ABC", "a@b.co", "Hodii")).toBe("otpauth://totp/Hodii%3Aa%40b.co?secret=ABC&issuer=Hodii&algorithm=SHA1&digits=6&period=30"));
});
