import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords, toCsv } from "./csv";

describe("csv", () => {
  it("reads quotes, commas and line breaks inside fields", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,"two\nlines",3\r\n')).toEqual([["a", "b, c", 'say "hi"'], ["1", "two\nlines", "3"]]);
  });
  it("drops blank lines and a leading BOM", () => { expect(parseCsv("﻿a,b\n\n,\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]); });
  it("keys records by normalised header", () => {
    const { headers, records } = parseCsvRecords("Listing Type, Price (KES)\nrent,45000\n");
    expect(headers).toEqual(["listing_type", "price_(kes)"]); expect(records[0]!["listing_type"]).toBe("rent");
  });
  it("round-trips awkward values", () => {
    const rows = [["t", "n"], ['He said "hi", ok', "line\nbreak"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("defuses spreadsheet formulas but leaves numbers alone", () => {
    const out = parseCsv(toCsv([["=SUM(A1)", "-5", "+254712345678", "@x", "-1.5"]]))[0]!;
    expect(out).toEqual(["'=SUM(A1)", "-5", "'+254712345678", "'@x", "-1.5"]);
  });
});
