import { describe, expect, it } from "vitest";
import { TEMPLATE_EXAMPLE, TEMPLATE_HEADERS, planImport, rowToForm } from "./bulk-import";
import { parseCsvRecords, toCsv } from "./csv";

const example = () => Object.fromEntries(TEMPLATE_HEADERS.map((h, i) => [h, TEMPLATE_EXAMPLE[i]!]));

describe("bulk import", () => {
  it("accepts the template's own example row", () => {
    const r = rowToForm(example(), 2);
    expect(r.errors).toEqual([]); expect(r.ok).toBe(true);
    expect(r.form).toMatchObject({ listingType: "rent", propertyType: "apartment", price: { amount: 55000, currency: "KES", period: "month", negotiable: false }, location: { countyCode: 47, areaName: "Kilimani" }, details: { bedrooms: 2 } });
    expect(r.form!.features).toContain("security_24h");
  });
  it("survives a round trip through a CSV file", () => {
    const csv = toCsv([[...TEMPLATE_HEADERS], TEMPLATE_EXAMPLE]);
    const { headers, records } = parseCsvRecords(csv);
    const plan = planImport(headers, records);
    expect(plan.headerProblems).toEqual([]); expect(plan.rows).toHaveLength(1); expect(plan.rows[0]!.ok).toBe(true);
  });
  it("explains what is wrong, row by row", () => {
    const r = rowToForm({ ...example(), county: "Atlantis", price: "abc", listing_type: "swap", features: "teleporter" }, 5);
    expect(r.ok).toBe(false); expect(r.row).toBe(5);
    expect(r.errors.join(" ")).toMatch(/county "Atlantis"/); expect(r.errors.join(" ")).toMatch(/price must be a number/); expect(r.errors.join(" ")).toMatch(/listing_type/); expect(r.errors.join(" ")).toMatch(/teleporter/);
  });
  it("applies the same rules as the listing form", () => {
    expect(rowToForm({ ...example(), property_type: "residential_plot", bedrooms: "3" }, 2).errors.join(" ")).toMatch(/Land cannot have bedrooms/);
    expect(rowToForm({ ...example(), listing_type: "sale", price_period: "month" }, 2).errors.join(" ")).toMatch(/priced/);
  });
  it("defaults the period and accepts friendly words", () => {
    const sale = rowToForm({ ...example(), listing_type: "For Sale", price_period: "", property_type: "Houses", price: "12,500,000" }, 2);
    expect(sale.errors).toEqual([]); expect(sale.form!.price!.period).toBe("total"); expect(sale.form!.price!.amount).toBe(12_500_000);
  });
  it("needs both coordinates or neither", () => { expect(rowToForm({ ...example(), longitude: "" }, 2).errors.join(" ")).toMatch(/both latitude and longitude/); });
  it("reports missing columns instead of failing every row", () => {
    const plan = planImport(["title", "price"], [{ title: "x", price: "1" }]);
    expect(plan.rows).toEqual([]); expect(plan.headerProblems[0]).toMatch(/Missing columns/);
  });
  it("caps the file at 200 rows", () => {
    const rows = Array.from({ length: 205 }, () => example());
    const plan = planImport([...TEMPLATE_HEADERS], rows); expect(plan.rows).toHaveLength(200); expect(plan.tooMany).toBe(true);
  });
});
