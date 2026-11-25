import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListFlaggedReviews, adminListNeighbourhoodFlags, adminModerateNeighbourhoodItem, adminModerateReview } from "@/lib/admin.functions";
import { useConfirm } from "@/components/admin/confirm";
import { LoaderBlock } from "@/components/loader";

/** Agency reviews that people reported. Three reports hide a review automatically; staff put it back or remove it. */
/** Neighbourhood reviews and chat messages people reported. Three different reporters hide an item until someone here decides. */
function NeighbourhoodFlags() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isPending, isError } = useQuery({ queryKey: ["admin", "neighbourhood-flags"], queryFn: () => adminListNeighbourhoodFlags() });
  const act = useMutation({
    mutationFn: (v: { kind: "review" | "post"; id: string; action: "restore" | "remove" }) => adminModerateNeighbourhoodItem({ data: v }),
    onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });
  return (
    <section aria-labelledby="nbflags" className="mt-10">
      <h2 id="nbflags" className="mb-3 text-lg font-extrabold">Neighbourhood reviews and chat</h2>
      {isPending ? <LoaderBlock /> : isError ? <p role="alert" className="text-sm text-destructive">Could not load reports.</p> : !data.length ? <p className="text-sm text-muted-foreground">Nothing reported.</p> : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">{r.kind === "review" ? "Review" : "Chat message"} · {r.area} · {r.username} · {r.reports} {r.reports === 1 ? "report" : "reports"} · <strong>{r.hidden ? "hidden" : "visible"}</strong></p>
              <p className="mt-2 whitespace-pre-line text-sm">{r.text || <em className="text-muted-foreground">(ratings only)</em>}</p>
              <div className="mt-3 flex gap-2">
                <button className="admin-btn" onClick={() => act.mutate({ kind: r.kind, id: r.id, action: "restore" })}>Keep (clear reports)</button>
                <button className="admin-btn" data-tone="danger" onClick={async () => { if (await confirm({ title: "Remove this?", body: "It is removed for good.", confirmLabel: "Remove" })) act.mutate({ kind: r.kind, id: r.id, action: "remove" }); }}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Reviews() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isPending, isError } = useQuery({ queryKey: ["admin", "reviews"], queryFn: () => adminListFlaggedReviews() });
  const act = useMutation({
    mutationFn: (v: { id: string; action: "restore" | "remove" }) => adminModerateReview({ data: v }),
    onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });
  if (isPending) return <LoaderBlock />;
  if (isError) return <p role="alert" className="text-sm text-destructive">Could not load reviews.</p>;
  if (!data.length) return <><p className="text-sm text-muted-foreground">No reported agency reviews.</p><NeighbourhoodFlags /></>;
  return (
    <>
    <ul className="space-y-3">
      {data.map((r) => (
        <li key={r.id} className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">{r.agency} · {r.username} · {r.rating} stars · {r.reports} {r.reports === 1 ? "report" : "reports"} · <strong>{r.status}</strong></p>
          <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
          <div className="mt-3 flex gap-2">
            {r.status === "hidden" && <button className="admin-btn" onClick={() => act.mutate({ id: r.id, action: "restore" })}>Put back</button>}
            <button className="admin-btn" data-tone="danger" onClick={async () => { if (await confirm({ title: "Delete this review?", body: "It is removed for good and the agency's rating is updated.", confirmLabel: "Delete review", tone: "danger" })) act.mutate({ id: r.id, action: "remove" }); }}>Delete</button>
          </div>
        </li>
      ))}
    </ul>
    <NeighbourhoodFlags />
    </>
  );
}
