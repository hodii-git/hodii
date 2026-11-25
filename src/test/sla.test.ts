import { describe, expect, it } from "vitest";
import { waiting } from "@/lib/sla";

const now = new Date("2026-06-10T12:00:00Z").getTime();
describe("waiting", () => {
  it("measures the wait and flags the overdue", () => {
    expect(waiting(new Date(now - 30 * 60_000), 24, now)).toEqual({ hours: 0, overdue: false, label: "under an hour" });
    expect(waiting(new Date(now - 5 * 3_600_000), 24, now).label).toBe("5 hours");
    expect(waiting(new Date(now - 30 * 3_600_000), 24, now).overdue).toBe(true);
    expect(waiting(new Date(now - 72 * 3_600_000), 48, now).label).toBe("3 days");
  });
  it("never flags when the target is off", () => {
    expect(waiting(new Date(now - 999 * 3_600_000), 0, now).overdue).toBe(false);
  });
});
