import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { FilterBadge, FiltersIcon, countFilters } from "@/components/ui/filters-icon";
import { HeaderPills } from "@/components/header-search";
import { HomeSearch } from "@/components/home/home-search";
import type { AiResult } from "@/components/property/ai-search-panel";
import type { SearchParams } from "@/lib/listing-search";

const btn = "xbtn relative inline-flex h-12 shrink-0 items-center gap-2.5 rounded-full border px-5 text-sm font-semibold text-foreground transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ring";

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
          <span className="relative grid"><FiltersIcon className="size-[1.15rem]" strokeWidth={2.4} /><FilterBadge n={n} /></span>Filters
        </button>
        <button type="button" data-tour="ask-ai" onClick={() => setPopup("ai")} aria-haspopup="dialog" className={btn}>
          <Sparkles className="size-4" style={{ stroke: "url(#hodii-grad)" }} aria-hidden />Ask AI
        </button>
      </div>
      <HomeSearch popup={popup} onPopupClose={() => setPopup(null)} value={value} onChange={onChange} deferred={deferred} {...(result ? { result } : {})} />
    </>
  );
}
