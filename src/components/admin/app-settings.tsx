import { Loader } from "@/components/loader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoaderBlock } from "@/components/loader";
import { adminGetAppSettings, adminSaveAppSettings } from "@/lib/admin.functions";

type Vals = Record<string, number | boolean>;

/** Prices, limits, quotas and ranking weights. Changes reach the site within about 30 seconds and are written to the activity log. */
export function AppSettings() {
  const qc = useQueryClient();
  const { data, isPending, isError } = useQuery({ queryKey: ["admin", "app-settings"], queryFn: () => adminGetAppSettings() });
  const [draft, setDraft] = useState<Vals>({});
  useEffect(() => { if (data) setDraft(data.values as Vals); }, [data]);
  const save = useMutation({
    mutationFn: (values: Vals) => adminSaveAppSettings({ data: { values } }),
    onSuccess: (r) => { if (!r.ok) { toast.error(r.error); return; } toast.success(r.changes.length ? `Saved ${r.changes.length} change${r.changes.length === 1 ? "" : "s"}` : "Nothing changed"); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  if (isPending) return <LoaderBlock />;
  if (isError || !data) return <p role="alert" className="text-sm text-destructive">Could not load settings.</p>;
  const changed = data.defs.filter((d) => draft[d.key] !== (data.values as Vals)[d.key]);
  return (
    <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); if (changed.length) save.mutate(Object.fromEntries(changed.map((d) => [d.key, draft[d.key]!]))); }}>
      {data.groups.map((g) => (
        <section key={g} aria-labelledby={`g-${g}`} className="admin-card space-y-4">
          <h2 id={`g-${g}`} className="text-lg font-bold">{g}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.defs.filter((d) => d.group === g).map((d) => (
              <div key={d.key}>
                <label htmlFor={d.key} className="admin-field-label">{d.label}{d.unit ? <span className="font-normal text-muted-foreground"> ({d.unit})</span> : null}</label>
                {d.type === "bool" ? (
                  <label className="mt-1 flex items-center gap-2 text-sm"><input id={d.key} type="checkbox" checked={draft[d.key] === true} onChange={(e) => setDraft({ ...draft, [d.key]: e.target.checked })} className="h-4 w-4" />{draft[d.key] === true ? "On" : "Off"}</label>
                ) : (
                  <input id={d.key} className="admin-input" type="number" inputMode="decimal" step={d.type === "int" ? 1 : 0.5} {...(d.min !== undefined ? { min: d.min } : {})} {...(d.max !== undefined ? { max: d.max } : {})} value={typeof draft[d.key] === "number" ? (draft[d.key] as number) : ""} onChange={(e) => setDraft({ ...draft, [d.key]: e.target.value === "" ? NaN : Number(e.target.value) })} />
                )}
                {d.help && <p className="mt-1 text-xs text-muted-foreground">{d.help}</p>}
                {draft[d.key] !== d.default && <button type="button" className="mt-1 text-xs font-semibold text-primary" onClick={() => setDraft({ ...draft, [d.key]: d.default })}>Use the standard value ({String(d.default)})</button>}
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3 shadow-lg">
        <p className="text-sm text-muted-foreground">{changed.length ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "No unsaved changes"}</p>
        <div className="flex gap-2">
          <button type="button" className="admin-btn" disabled={!changed.length} onClick={() => setDraft(data.values as Vals)}>Discard</button>
          <button className="admin-btn" data-tone="primary" disabled={!changed.length || save.isPending}>{save.isPending ? <Loader size="xs" label="Saving" /> : "Save changes"}</button>
        </div>
      </div>
    </form>
  );
}
