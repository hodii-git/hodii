import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminListFeedback, adminUpdateFeedback } from "@/lib/admin.functions";
import { LoaderBlock } from "@/components/loader";
import { timeAgo } from "@/lib/format";

const KIND_LABEL: Record<string, string> = { like: "Likes something", idea: "Idea", confusing: "Confusing", bug: "Broken", down: "Down / slow", other: "Other" };
const KIND_TONE: Record<string, string> = { bug: "bg-red-500/15 text-red-700 dark:text-red-300", down: "bg-red-500/15 text-red-700 dark:text-red-300", confusing: "bg-amber-500/15 text-amber-700 dark:text-amber-300", idea: "bg-sky-500/15 text-sky-700 dark:text-sky-300", like: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };

/** What visitors sent through the Feedback button. Broken and down reports are the ones to read first. */
export function Feedback() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"all" | "new" | "seen" | "resolved">("new");
  const [kind, setKind] = useState<"all" | "like" | "idea" | "confusing" | "bug" | "down" | "other">("all");
  const [page, setPage] = useState(1);
  const key = ["admin", "feedback", status, kind, page];
  const { data, isPending, isError } = useQuery({ queryKey: key, queryFn: () => adminListFeedback({ data: { status, kind, page } }), refetchInterval: 60_000 });
  const upd = useMutation({ mutationFn: (v: { id: string; status?: "new" | "seen" | "resolved"; adminNote?: string }) => adminUpdateFeedback({ data: v }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "feedback"] }) });
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (isPending) return <LoaderBlock />;
  if (isError) return <p role="alert" className="text-sm text-destructive">Could not load feedback.</p>;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-sm font-semibold ${active ? "border-primary bg-primary/10" : "border-border"}`;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">New</p><p className="text-2xl font-extrabold">{data.byStatus["new"] ?? 0}</p></div>
        <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">Broken or down (not resolved)</p><p className="text-2xl font-extrabold">{(data.byKind["bug"] ?? 0) + (data.byKind["down"] ?? 0)}</p></div>
        <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">Average rating</p><p className="text-2xl font-extrabold">{data.averageRating ?? "-"}<span className="text-sm font-normal text-muted-foreground"> {data.ratingCount ? `from ${data.ratingCount}` : ""}</span></p></div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {(["new", "seen", "resolved", "all"] as const).map((s) => <button key={s} type="button" aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }} className={chip(status === s)}>{s[0]!.toUpperCase() + s.slice(1)}</button>)}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by kind">
        {(["all", "bug", "down", "confusing", "idea", "like", "other"] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setPage(1); }} className={chip(kind === k)}>{k === "all" ? "All kinds" : KIND_LABEL[k]}</button>)}
      </div>
      {!data.items.length ? <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">Nothing here.</p> : (
        <ul className="space-y-3">
          {data.items.map((f) => (
            <li key={f.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 font-bold ${KIND_TONE[f.kind] ?? "bg-muted text-muted-foreground"}`}>{KIND_LABEL[f.kind] ?? f.kind}</span>
                {f.rating && <span aria-label={`${f.rating} out of 5`}>{"★".repeat(f.rating)}<span className="text-muted-foreground">{"★".repeat(5 - f.rating)}</span></span>}
                <span className="text-muted-foreground">{timeAgo(f.createdAt)} · {f.signedIn ? (f.name ?? "signed in") : "visitor"} · <code>{f.page}</code>{f.viewport ? ` · ${f.viewport}` : ""}</span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-bold">{f.status}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{f.message}</p>
              {f.email && <p className="mt-1 text-xs text-muted-foreground">May contact: <a className="underline" href={`mailto:${f.email}`}>{f.email}</a></p>}
              {f.device && <p className="mt-1 truncate text-xs text-muted-foreground" title={f.device}>{f.device}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input aria-label="Internal note" placeholder="Internal note" value={notes[f.id] ?? f.adminNote ?? ""} onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })} onBlur={() => { const n = notes[f.id]; if (n !== undefined && n !== (f.adminNote ?? "")) upd.mutate({ id: f.id, adminNote: n }); }} className="h-9 min-w-48 flex-1 rounded-lg border border-input bg-background px-3 text-sm" />
                {f.status !== "seen" && <button type="button" className="text-sm font-semibold" onClick={() => upd.mutate({ id: f.id, status: "seen" })}>Mark seen</button>}
                {f.status !== "resolved" ? <button type="button" className="text-sm font-semibold text-primary" onClick={() => upd.mutate({ id: f.id, status: "resolved" })}>Resolved</button> : <button type="button" className="text-sm font-semibold" onClick={() => upd.mutate({ id: f.id, status: "new" })}>Reopen</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && <div className="flex items-center justify-center gap-3 text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="font-semibold disabled:opacity-40">Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="font-semibold disabled:opacity-40">Next</button></div>}
    </div>
  );
}
