import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminListErrors, adminResolveError } from "@/lib/admin.functions";
import { LoaderBlock } from "@/components/loader";
import { timeAgo } from "@/lib/format";

/** Errors the site has hit, grouped so one bug is one row. Set ALERT_WEBHOOK_URL to also get a chat message for each new one. */
export function Errors() {
  const qc = useQueryClient();
  const { data, isPending, isError } = useQuery({ queryKey: ["admin", "errors"], queryFn: () => adminListErrors(), refetchInterval: 60_000 });
  const done = useMutation({ mutationFn: (id: string) => adminResolveError({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "errors"] }) });
  const [open, setOpen] = useState<string | null>(null);
  if (isPending) return <LoaderBlock />;
  if (isError) return <p role="alert" className="text-sm text-destructive">Could not load errors.</p>;
  if (!data.length) return <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">No errors recorded. That is good news.</p>;
  return (
    <ul className="space-y-2">
      {data.map((e) => (
        <li key={e.id} className={`rounded-2xl border p-4 ${e.resolved ? "border-border opacity-60" : "border-destructive/40"}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><p className="break-words font-semibold">{e.message}</p><p className="mt-1 text-xs text-muted-foreground">{e.source} · {e.count}× · last {timeAgo(e.lastSeen)}{e.path ? ` · ${e.path}` : ""}</p></div>
            <div className="flex gap-2">
              {e.stack && <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} className="text-sm font-semibold text-primary">{open === e.id ? "Hide details" : "Details"}</button>}
              {!e.resolved && <button type="button" onClick={() => done.mutate(e.id)} className="text-sm font-semibold">Mark fixed</button>}
            </div>
          </div>
          {open === e.id && e.stack && <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">{e.stack}</pre>}
        </li>
      ))}
    </ul>
  );
}
