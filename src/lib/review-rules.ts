/** Rules for agency reviews. Pure, so they are tested without a database. */
export const REVIEWS_PER_DAY = 5;
export const REPORTS_TO_HIDE = 3;

export type RatingSummary = { count: number; avg: number; distribution: [number, number, number, number, number] };

/** Average to one decimal, plus how many reviews gave each star count (index 0 is one star). */
export function summarise(ratings: number[]): RatingSummary {
  const distribution: RatingSummary["distribution"] = [0, 0, 0, 0, 0];
  for (const r of ratings) if (r >= 1 && r <= 5) distribution[r - 1]!++;
  const count = distribution.reduce((a, b) => a + b, 0);
  const avg = count ? Math.round((distribution.reduce((s, n, i) => s + n * (i + 1), 0) / count) * 10) / 10 : 0;
  return { count, avg, distribution };
}

export const shouldHide = (reports: number) => reports >= REPORTS_TO_HIDE;

/** Small agencies with one or two reviews should not look better or worse than they are: show the average, but say how many it rests on. */
export const trustLabel = (count: number, avg: number) =>
  count === 0 ? "No reviews yet" : count < 3 ? `${avg.toFixed(1)} from ${count} ${count === 1 ? "review" : "reviews"} (too few to rank)` : `${avg.toFixed(1)} from ${count} reviews`;
