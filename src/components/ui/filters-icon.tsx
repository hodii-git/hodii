import type { SVGProps } from "react";
import type { SearchParams } from "@/lib/listing-search";

/** The simple two-line filters icon (two bars, each with a ring) used everywhere filters are opened, on every screen size. */
export function FiltersIcon({ className = "size-5", strokeWidth = 2.3, ...rest }: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" aria-hidden {...rest}>
      <path d="M3 8h11M22 8h3M3 20h3M14 20h11" /><circle cx="18" cy="8" r="3.4" /><circle cx="10" cy="20" r="3.4" />
    </svg>
  );
}

/** A very small gradient circle with the number of filters that are on, sitting on the top right of the filters icon. */
export function FilterBadge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="fbadge" aria-label={`${n} filter${n === 1 ? "" : "s"} on`}>{n}</span>;
}

/** How many filters are set, for the small number on the Filters button. */
export const countFilters = (v: SearchParams) =>
  [v.listingType, v.countyCodes?.length || v.circle || v.polygon, v.priceMax, v.category, v.propertyTypes?.length, v.priceMin, v.bedroomsMin, v.bathroomsMin, v.areaSqmMin, v.areaSqmMax, v.features?.length, v.furnishing, v.conditions?.length, v.verifiedOnly].filter(Boolean).length;

