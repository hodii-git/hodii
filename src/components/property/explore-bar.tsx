import { useEffect, useState } from "react";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import { HeaderPills } from "@/components/header-search";
import { HomeSearch } from "@/components/home/home-search";
import type { AiResult } from "@/components/property/ai-search-panel";
import type { SearchParams } from "@/lib/listing-search";

/** How many filters are set, for the small number on the Filters button. */
const countFilters = (v: SearchParams) =>
  [v.listingType, v.countyCodes?.length || v.circle || v.polygon, v.priceMax, v.category, v.propertyTypes?.length, v.priceMin, v.bedroomsMin, v.bathroomsMin, v.areaSqmMin, v.areaSqmMax, v.features?.length, v.furnishing, v.conditions?.length, v.verifiedOnly].filter(Boolean).length;

const btn = "relative inline-flex h-[3.25rem] shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Large screens: the property-type chips on the content side, then Filters and Ask AI at the end of the row.
 * Both buttons open a full overlay popup; Ask AI shows the same card as the phone's search sheet.
 * Below large screens the chips stay under the header and the phone search sheet is used instead, so this renders nothing there.
 */
export function ExploreBar({ value, onChange, result, deferred = false }: { value: SearchParams; onChange: (next: Partial<SearchParams>) => void; result?: AiResult; deferred?: boolean }) {
  const [popup, setPopup] = useState<"ai" | "filters" | null>(null);
  const n = countFilters(value);
  // The phone header's filters icon and round AI button open the same popups.
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<string>).detail; if (d === "ai" || d === "filters") setPopup(d); };
    window.addEventListener("hodii:open-popup", on);
    return () => window.removeEventListener("hodii:open-popup", on);
  }, []);
  return (
    <>
      <div className="hidden items-center gap-4 lg:flex">
        <div className="min-w-0 flex-1"><HeaderPills fade="page" /></div>
        <button type="button" onClick={() => setPopup("filters")} aria-haspopup="dialog" className={btn}>
          <SlidersHorizontal className="size-4" aria-hidden />Filters
          {n > 0 && <span className="cta grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full px-1 text-[0.65rem] font-bold leading-none">{n}</span>}
        </button>
        <button type="button" data-tour="ask-ai" onClick={() => setPopup("ai")} aria-haspopup="dialog" className={btn}>
          <Sparkles className="size-4" style={{ stroke: "url(#hodii-grad)" }} aria-hidden />Ask AI
        </button>
      </div>
      <HomeSearch popup={popup} onPopupClose={() => setPopup(null)} value={value} onChange={onChange} deferred={deferred} {...(result ? { result } : {})} />
    </>
  );
}
