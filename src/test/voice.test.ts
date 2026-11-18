import { describe, expect, it } from "vitest";
import { base64Bytes, baseMime, cleanTranscript, extFor, voiceLimitFor } from "@/lib/voice";

describe("voice rules", () => {
  it("accepts known audio kinds and strips codec details", () => {
    expect(baseMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(baseMime("AUDIO/MP4")).toBe("audio/mp4");
    expect(baseMime("video/mp4")).toBeNull();
    expect(baseMime("")).toBeNull();
  });
  it("names the file by kind", () => { expect(extFor("audio/mp4")).toBe("m4a"); expect(extFor("audio/ogg")).toBe("ogg"); });
  it("measures base64 without decoding", () => {
    expect(base64Bytes(Buffer.from("hello world!").toString("base64"))).toBe(12);
    expect(base64Bytes(Buffer.from("hello").toString("base64"))).toBe(5);
  });
  it("treats filler and silence as nothing heard", () => {
    expect(cleanTranscript("  Thank you. ")).toBe("");
    expect(cleanTranscript("")).toBe("");
    expect(cleanTranscript(undefined)).toBe("");
    expect(cleanTranscript("2 bedroom   in Kilimani\n under 80k")).toBe("2 bedroom in Kilimani under 80k");
  });
  it("picks the limit for the tier", () => {
    const v = { "voice.guestLimit": 1, "voice.userLimit": 2, "voice.agencyLimit": 3, "voice.premiumLimit": 4 };
    expect(["guest", "user", "agency", "premium"].map((t) => voiceLimitFor(t as never, v))).toEqual([1, 2, 3, 4]);
  });
});
