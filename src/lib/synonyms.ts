/** Words people use for the same thing in Kenyan listings. A search for any one finds all of them. Lower case, single words after plural trimming. */
const GROUPS: string[][] = [
  ["flat", "apartment"],
  ["bedsit", "bedsitter", "bed sitter"],
  ["maisonette", "maisonnette"],
  ["townhouse", "town house"],
  ["sq", "dsq", "servant quarter", "domestic staff quarter"],
  ["cctv", "security camera"],
  ["borehole", "bore hole"],
  ["ensuite", "en suite", "en-suite"],
  ["gated", "gated community"],
  ["tolet", "to let"],
];

const index = new Map<string, string[]>();
for (const g of GROUPS) for (const w of g) index.set(w, g);

/** The word itself plus its alternatives. Always includes the original first. */
export function expand(word: string): string[] {
  const w = word.toLowerCase();
  const g = index.get(w) ?? index.get(w.replace(/s$/, ""));
  return g ? [w, ...g.filter((x) => x !== w)] : [w];
}
