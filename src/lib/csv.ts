/** A small, strict CSV reader and writer (RFC 4180): quoted fields, doubled quotes, commas and line breaks inside quotes, a leading BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i += 2; continue; } quoted = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"' && field === "") { quoted = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Header row + records keyed by normalised header (lower case, spaces and dashes become underscores). */
export function parseCsvRecords(text: string): { headers: string[]; records: Record<string, string>[] } {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  return { headers, records: rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]))) };
}

/**
 * Writes CSV. A cell that starts with = + - @ or a tab could be run as a formula when the file is opened in a spreadsheet,
 * so those are prefixed with an apostrophe.
 */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `\uFEFF${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
}
