import { useToolHint } from "@/components/tool-hint";
import { useState } from "react";
import { Sel } from "@/components/ui/sel";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellPlus } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { createSavedSearch } from "@/lib/notifications.functions";
import { COUNTY_LIST } from "@/lib/mongodb/kenya";
import { listingTypeLabel } from "@/lib/format";
import type { SearchParams } from "@/lib/listing-search";

export const FREQUENCY_LABEL = { instant: "As soon as it appears", daily: "Once a day", weekly: "Once a week", off: "Paused" } as const;

/** Only the filters, not the sorting or page, are kept in a saved search. */
export function criteriaOf(p: Partial<SearchParams>) {
  const { sort: _s, page: _p, pageSize: _z, ...rest } = p;
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))) as Omit<SearchParams, "sort" | "page" | "pageSize">;
}

/** A short name for a search, such as "Apartments for rent in Nairobi". */
export function nameSearch(p: Partial<SearchParams>) {
  const county = p.countyCodes?.length === 1 ? COUNTY_LIST.find((c) => c.code === p.countyCodes![0])?.name : undefined;
  const type = p.listingType ? listingTypeLabel(p.listingType).toLowerCase() : "";
  const what = p.propertyTypes?.length === 1 ? p.propertyTypes[0]!.replace(/_/g, " ") : p.category ?? "properties";
  return `${what[0]!.toUpperCase()}${what.slice(1)}${type ? ` ${type}` : ""}${county ? ` in ${county}` : ""}${p.q ? ` “${p.q}”` : ""}`.slice(0, 60);
}

export function SaveSearchButton({ params }: { params: Partial<SearchParams> }) {
  const hint = useToolHint("Get alerts for this search");
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<keyof typeof FREQUENCY_LABEL>("instant");
  const save = useMutation({
    mutationFn: () => createSavedSearch({ data: { name: name.trim() || nameSearch(params), criteria: criteriaOf(params), frequency } }),
    onSuccess: (r) => {
      if (!r.ok) return void toast.error(r.error);
      toast.success("Search saved. We will tell you in your notifications.");
      qc.invalidateQueries({ queryKey: ["saved"] });
      setOpen(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setName(nameSearch(params)); }}>
      <span className="relative inline-flex">{hint.bubble}<PopoverTrigger asChild><button type="button" data-tour="save-search" aria-label="Save search" {...hint.handlers} className="tool-btn"><BellPlus className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Save search</span></button></PopoverTrigger></span>
      <PopoverContent align="start" className="glass-menu w-80 rounded-3xl p-4">
        {!user ? (
          <p className="text-sm"><Link to="/auth" search={{ redirect: "/properties" }} className="font-bold text-primary underline">Sign in</Link> to save this search and get told when new properties match it.</p>
        ) : (
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div><label htmlFor="ss-name" className="text-xs font-bold text-muted-foreground">Name</label><input id="ss-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="auth-input mt-1 h-10" /></div>
            <div><label htmlFor="ss-freq" className="text-xs font-bold text-muted-foreground">Tell me</label>
              <Sel id="ss-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as keyof typeof FREQUENCY_LABEL)} className="auth-input mt-1 h-10">
                {(["instant", "daily", "weekly"] as const).map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
              </Sel></div>
            <button disabled={save.isPending} className="h-10 rounded-full bg-primary font-bold text-primary-foreground">Save this search</button>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
