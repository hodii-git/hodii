import { describe, expect, it } from "vitest";
import { near, searchArticles, words, type Article } from "@/lib/guide-search";

const A = (id: string, title: string, keywords: string[], p = "", audience: "user" | "agency" = "user"): Article => ({ id, audience, category: "x", title, summary: "", keywords, body: [{ p }] });
const all = [A("verify", "Get your agency verified", ["verification", "badge"], "Add your registration number", "agency"), A("save", "Save a property", ["favourite", "heart"], "Tap the heart"), A("ai", "Ask AI", ["natural language"], "Describe what you want")];

describe("guide search", () => {
  it("finds by title, keyword and body", () => {
    expect(searchArticles(all, "verified")[0]!.id).toBe("verify");
    expect(searchArticles(all, "favourite")[0]!.id).toBe("save");
    expect(searchArticles(all, "describe")[0]!.id).toBe("ai");
  });
  it("forgives plurals and a typo", () => {
    expect(searchArticles(all, "properties")[0]!.id).toBe("save");
    expect(searchArticles(all, "verifcation")[0]!.id).toBe("verify");
  });
  it("needs every word and can filter by audience", () => {
    expect(searchArticles(all, "heart badge")).toEqual([]);
    expect(searchArticles(all, "", "agency").map((a) => a.id)).toEqual(["verify"]);
  });
  it("near() allows one letter", () => {
    expect(near("verifcation", "verification")).toBe(true);
    expect(near("cat", "car")).toBe(false);
    expect(words("Saving Heart!")).toEqual(["sav", "heart"]);
  });
});
