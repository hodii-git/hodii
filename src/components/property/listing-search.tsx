import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { HomeSearch } from "@/components/home/home-search";
import { setSheet } from "@/lib/search-sheet";
import { paramsFromUrl, urlFromParams } from "@/lib/search-url";
import type { SearchParams } from "@/lib/listing-search";

export const OPEN_LISTING_SEARCH = "hodii:open-search";

/**
 * The explore page's search bar, opened from the Filters button on a listing. It is the same component the home page uses:
 * a filter, Enter or Ask AI sends the person to the search results. On phones it is the bottom sheet; on wider screens a dialog.
 * Its dark look lives in styles.css (.ls-wrap, .ls-card and the .m-sheet rules for the dark listing page).
 */
export function ListingSearch() {
  const navigate = useNavigate();
  const [deskOpen, setDeskOpen] = useState(false);
  const change = (next: Partial<SearchParams>) => {
    setDeskOpen(false);
    setSheet(false);
    void navigate({ to: "/", search: urlFromParams({ ...paramsFromUrl({}), ...next, page: 1 }) });
  };
  useEffect(() => {
    const open = () => { if (window.matchMedia("(max-width: 767px)").matches) setSheet(true); else setDeskOpen(true); };
    window.addEventListener(OPEN_LISTING_SEARCH, open);
    return () => window.removeEventListener(OPEN_LISTING_SEARCH, open);
  }, []);
  useEffect(() => {
    if (!deskOpen) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setDeskOpen(false);
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [deskOpen]);
  useEffect(() => () => setSheet(false), []);
  return (
    <div className="ls-wrap" data-open={deskOpen} onMouseDown={(e) => { if (e.target === e.currentTarget) setDeskOpen(false); }}>
      <div className="ls-card">
        <div className="ls-head">
          <span className="text-base font-extrabold">Search</span>
          <button type="button" onClick={() => setDeskOpen(false)} aria-label="Close search" className="grid size-9 place-items-center rounded-full bg-[#26262a] text-white"><X className="size-4" aria-hidden /></button>
        </div>
        <HomeSearch deferred value={paramsFromUrl({})} onChange={change} />
      </div>
    </div>
  );
}
