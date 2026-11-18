import { useCallback, useEffect, useRef, useState } from "react";
import { Loader } from "@/components/loader";
import { Results } from "./results";
import type { PropertyCard } from "@/lib/property-dto";

type Page = { items: PropertyCard[]; total: number; page: number; pageSize: number; fuzzy?: boolean; nearest?: string[] };

/**
 * Listings that keep loading as the person scrolls: the first page comes with the route, the next ones are fetched when the end of
 * the list comes into view. `resetKey` changes whenever the search does, which starts the list again from the first page.
 * There is also a "Show more" button for anyone whose browser cannot watch scrolling.
 */
export function InfiniteResults({ first, resetKey, fetchPage, unavailable = false, emptyText }: { first: Page; resetKey: string; fetchPage: (page: number) => Promise<Page>; unavailable?: boolean; emptyText?: string }) {
  const [items, setItems] = useState<PropertyCard[]>(first.items);
  const [page, setPage] = useState(first.page);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const total = first.total;
  const key = useRef(resetKey);
  const end = useRef<HTMLDivElement>(null);

  // A new search (or fresh first page) replaces everything.
  useEffect(() => { key.current = resetKey; setItems(first.items); setPage(first.page); setFailed(false); }, [resetKey, first]);

  const more = useCallback(async () => {
    if (busy || failed || items.length >= total) return;
    const mine = key.current;
    setBusy(true);
    try {
      const next = await fetchPage(page + 1);
      if (key.current !== mine) return; // the search changed while this was loading
      setItems((cur) => { const seen = new Set(cur.map((c) => c.id)); return [...cur, ...next.items.filter((c) => !seen.has(c.id))]; });
      setPage(page + 1);
      if (!next.items.length) setFailed(true);
    } catch { setFailed(true); } finally { setBusy(false); }
  }, [busy, failed, items.length, total, fetchPage, page]);

  useEffect(() => {
    const el = end.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) void more(); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more]);

  const hasMore = items.length < total && !failed;
  return (
    <>
      {first.nearest && <p role="status" className="mb-3 rounded-xl bg-muted px-4 py-2.5 text-sm"><b>Nothing matches exactly.</b> These are the nearest matches, with {first.nearest.length > 1 ? first.nearest.slice(0, -1).join(", ") + " and " + first.nearest[first.nearest.length - 1] : first.nearest[0]} loosened.</p>}
      {first.fuzzy && <p role="status" className="mb-3 rounded-xl bg-muted px-4 py-2.5 text-sm">No exact match for those words, so these are the closest spellings.</p>}
      <Results items={items} unavailable={unavailable} {...(emptyText ? { emptyText } : {})} />
      {(hasMore || failed) && items.length < total && (
        <div ref={end} className="mt-8 flex flex-col items-center gap-3 py-4">
          {busy ? <Loader label="Loading more properties" /> : <button type="button" onClick={() => { setFailed(false); void more(); }} className="rounded-full border border-input bg-background px-6 py-2.5 text-sm font-semibold">{failed ? "Could not load more. Try again" : "Show more"}</button>}
        </div>
      )}
      {items.length > 0 && items.length >= total && total > first.pageSize && <p className="mt-8 text-center text-sm text-muted-foreground">You have seen all {total.toLocaleString("en-KE")} properties.</p>}
    </>
  );
}
