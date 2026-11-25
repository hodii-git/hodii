import { EmptyState } from "@/components/states";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { SearchX } from "lucide-react";
import { PropertyGrid } from "./property-card";
import { DataUnavailable } from "@/components/data-unavailable";
import { useAuth } from "@/hooks/use-auth";
import { getSavedState } from "@/lib/properties.functions";
import type { PropertyCard } from "@/lib/property-dto";

/** Which of these listings the signed-in person has saved. One small request per page, only when signed in. */
export function useSavedSet(items: readonly PropertyCard[]) {
  const { user } = useAuth();
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const { data } = useQuery({ queryKey: ["saved", "state", user?.id ?? null, ids], queryFn: () => getSavedState({ data: { ids } }), enabled: !!user && ids.length > 0, staleTime: 30_000 });
  return useMemo(() => new Set(data?.saved ?? []), [data]);
}

export function Results({ items, unavailable, emptyText }: { items: PropertyCard[]; unavailable: boolean; emptyText?: string }) {
  const saved = useSavedSet(items);
  if (unavailable) return <DataUnavailable />;
  return (
    <PropertyGrid items={items} saved={saved} empty={
      <div role="status"><EmptyState icon={<SearchX />} title="Nothing here yet">{emptyText ?? "No properties match your search. Try widening the price range or removing a filter."}</EmptyState></div>
    } />
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-full border border-input bg-background px-5 py-2 text-sm font-semibold disabled:opacity-40">Previous</button>
      <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-full border border-input bg-background px-5 py-2 text-sm font-semibold disabled:opacity-40">Next</button>
    </nav>
  );
}
