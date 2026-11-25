import { LoaderBlock } from "@/components/loader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminDecideAgency, adminDecideListing, adminDecideReport, adminModerationOverview } from "@/lib/admin.functions";
import { REPORT_REASONS } from "@/lib/mongodb/taxonomy";

const fail = (e: unknown) => toast.error(e instanceof Error && !/^[[{]/.test(e.message) ? e.message : "Something went wrong");
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "");
const reasonLabel = (k: string) => REPORT_REASONS.find((r) => r.key === k)?.label ?? k;

/** Asks for a short reason, then runs `onSend`. Used wherever a decision needs explaining to the lister. */
function ReasonButton({ label, onSend, busy }: { label: string; onSend: (reason: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) return <button type="button" className="admin-btn" data-tone="danger" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <form className="flex w-full flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 5) onSend(text.trim()); else toast.error("Write a short reason first"); }}>
      <label className="sr-only" htmlFor="mod-reason">Reason</label>
      <input id="mod-reason" autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Reason shown to the agent" className="admin-input min-w-0 flex-1" />
      <button className="admin-btn" data-tone="danger" disabled={busy}>Send</button>
      <button type="button" className="admin-btn" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}

export function Moderation({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data, isPending, isError } = useQuery({ queryKey: ["admin", "moderation"], queryFn: () => adminModerationOverview(), refetchInterval: 60_000 });
  const done = (msg: string) => () => { toast.success(msg); qc.invalidateQueries({ queryKey: ["admin", "moderation"] }); };
  const listing = useMutation({ mutationFn: (v: { id: string; decision: "approve" | "reject"; reason?: string }) => adminDecideListing({ data: v }), onSuccess: done("Done"), onError: fail });
  const agency = useMutation({ mutationFn: (v: { id: string; decision: "verify" | "reject"; reason?: string }) => adminDecideAgency({ data: v }), onSuccess: done("Done"), onError: fail });
  const report = useMutation({ mutationFn: (v: { id: string; decision: "dismiss" | "pause_listing" | "remove_listing"; note?: string }) => adminDecideReport({ data: v }), onSuccess: done("Done"), onError: fail });
  const [open, setOpen] = useState<string | null>(null);

  if (isPending) return <LoaderBlock className="py-10" />;
  if (isError) return <p role="alert" className="text-sm text-destructive">Could not load the moderation queue.</p>;

  return (
    <div className="space-y-10">
      <div><h1 className="admin-title">Moderation</h1><p className="mt-1 text-sm text-muted-foreground">{data.counts.listings} listings, {data.counts.agencies} agencies and {data.counts.reports} reports waiting.</p></div>

      <section aria-labelledby="mod-listings" className="space-y-3">
        <h2 id="mod-listings" className="text-lg font-bold">Listings to review</h2>
        {!data.listings.length && <div className="admin-card text-sm text-muted-foreground">Nothing waiting.</div>}
        {data.listings.map((l) => (
          <article key={l.id} className="admin-card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="font-bold">{l.title}</p><p className="text-sm text-muted-foreground">{l.price} · {l.place} · ref {l.referenceCode}</p><p className="text-xs text-muted-foreground">{l.agency.name}{l.agency.verified ? " (verified)" : " (not verified)"} · submitted {when(l.submittedAt)} · {l.imageCount} photos</p></div>
              <button type="button" className="admin-btn" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Hide" : "Read"}</button>
            </div>
            {open === l.id && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex gap-2 overflow-x-auto">{l.images.map((i) => <img key={i.url} src={i.url} alt={i.alt} loading="lazy" className="h-24 w-32 shrink-0 rounded-lg object-cover" />)}</div>
                <p className="whitespace-pre-line text-sm">{l.description}</p>
              </div>
            )}
            {l.problems.length > 0 && <p role="note" className="text-sm font-semibold text-destructive">Incomplete: {l.problems.join("; ")}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="admin-btn" data-tone="primary" disabled={listing.isPending || l.problems.length > 0} onClick={() => listing.mutate({ id: l.id, decision: "approve" })}>Approve and publish</button>
              <ReasonButton label="Reject" busy={listing.isPending} onSend={(reason) => listing.mutate({ id: l.id, decision: "reject", reason })} />
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="mod-agencies" className="space-y-3">
        <h2 id="mod-agencies" className="text-lg font-bold">Agencies awaiting verification</h2>
        {!isAdmin && <div className="admin-card text-sm text-muted-foreground">Only full admins can verify agencies.</div>}
        {isAdmin && !data.agencies.length && <div className="admin-card text-sm text-muted-foreground">Nothing waiting.</div>}
        {isAdmin && data.agencies.map((a) => (
          <article key={a.id} className="admin-card space-y-3">
            <div><p className="font-bold">{a.name}</p><p className="text-sm text-muted-foreground">{a.kind.replace("_", " ")} · {a.phone} · {a.email}</p>
              <p className="text-sm">Business reg: <strong>{a.businessRegNumber ?? "none"}</strong> · EARB: <strong>{a.earbNumber ?? "none"}</strong>{a.website && <> · <a href={a.website} target="_blank" rel="noopener noreferrer nofollow" className="underline">website</a></>}</p>
              <p className="text-xs text-muted-foreground">Submitted {when(a.submittedAt)}.<span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${a.wait.overdue ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-muted text-muted-foreground"}`}>Waiting {a.wait.label}{a.wait.overdue ? " · overdue" : ""}</span> Check the numbers against the public registers before approving.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="admin-btn" data-tone="primary" disabled={agency.isPending} onClick={() => agency.mutate({ id: a.id, decision: "verify" })}>Verify</button>
              <ReasonButton label="Reject" busy={agency.isPending} onSend={(reason) => agency.mutate({ id: a.id, decision: "reject", reason })} />
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="mod-reports" className="space-y-3">
        <h2 id="mod-reports" className="text-lg font-bold">Reported listings</h2>
        {!data.reports.length && <div className="admin-card text-sm text-muted-foreground">No open reports.</div>}
        {data.reports.map((r) => (
          <article key={r.id} className="admin-card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="font-bold">{reasonLabel(r.reason)}</p>{r.details && <p className="text-sm">{r.details}</p>}
                <p className="text-xs text-muted-foreground">{when(r.createdAt)}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${r.wait.overdue ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-muted text-muted-foreground"}`}>Waiting {r.wait.label}{r.wait.overdue ? " · overdue" : ""}</span>{r.property && ` · ${r.property.openReports} open report${r.property.openReports === 1 ? "" : "s"} on this listing`}</p></div>
              {r.property && <a href={`/property/${r.property.slug}`} target="_blank" rel="noopener" className="admin-btn">{r.property.title.slice(0, 40)} ({r.property.status})</a>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="admin-btn" disabled={report.isPending} onClick={() => report.mutate({ id: r.id, decision: "dismiss" })}>Dismiss</button>
              <button type="button" className="admin-btn" disabled={report.isPending || !r.property} onClick={() => report.mutate({ id: r.id, decision: "pause_listing" })}>Pause listing</button>
              <button type="button" className="admin-btn" data-tone="danger" disabled={report.isPending || !r.property} onClick={() => confirm("Remove this listing from the site? The agent will see it as rejected.") && report.mutate({ id: r.id, decision: "remove_listing" })}>Remove listing</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
