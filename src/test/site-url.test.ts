import { describe, expect, it } from "vitest";
import { absUrl, CONTACT_EMAIL } from "@/lib/site";

describe("public site address", () => {
  it("builds absolute links on hodii.co.ke", () => {
    expect(absUrl("/article/x")).toBe("https://hodii.co.ke/article/x");
    expect(absUrl()).toBe("https://hodii.co.ke/");
  });
  it("uses the hodii.co.ke email domain", () => {
    expect(CONTACT_EMAIL).toBe("hello@hodii.co.ke");
  });
});
