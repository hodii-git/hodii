import { LoaderBlock } from "@/components/loader";
import { createFileRoute, getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { Sel } from "@/components/ui/sel";
import { Pick } from "@/components/ui/pick";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Inbox, Plus, Snowflake, Upload } from "lucide-react";
import { SpaceMeter } from "@/components/dashboard/space-meter";
import { getListingSpace } from "@/lib/payments.functions";
import { useState } from "react";
import { TypedConfirm } from "@/components/typed-confirm";
import { deletePhrase } from "@/lib/bulk-rules";
import { toast } from "sonner";
import { Badge, btnGhost, btnPrimary, errorText, inputCls, PageHeader } from "@/components/dashboard/ui";
import { Pager } from "@/components/property/results";
import { can } from "@/lib/access";
import { bulkListingAction, exportAgencyListings, getAgencyListings, getAgencyAgents, renewListing, setListingStatus } from "@/lib/dashboard.functions";
import { formatPrice, propertyTypeLabel, timeAgo } from "@/lib/format";

const STATUSES = ["draft", "pending_review", "published", "paused", "frozen", "expired", "rejected", "closed"] as const;
type Status = (typeof STATUSES)[number];
type BulkVars = { ids: string[]; what: string; action: "pause" | "resume" | "renew" | "close" | "price_percent" | "assign_agent" | "delete"; reason?: "sold" | "let" | "withdrawn"; percent?: number; agentId?: string | null; confirmText?: string; password?: string };
const parent = getRouteApi("/_authenticated/dashboard/agency/$slug");
const listQuery = (slug: string, status: Status | undefined, q: string | undefined, page: number) =>
  queryOptions({ queryKey: ["agency", slug, "listings", status ?? null, q ?? null, page], queryFn: () => getAgencyListings({ data: { slug, ...(status ? { status } : {}), ...(q ? { q } : {}), page } }), refetchInterval: 30_000 });

export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/listings/")({
  validateSearch: (s): { status?: Status | undefined; q?: string | undefined; page?: number | undefined } => ({
    ...(STATUSES.includes(s["status"] as Status) ? { status: s["status"] as Status } : {}), ...(typeof s["q"] === "string" && s["q"] ? { q: s["q"].slice(0, 80) } : {}),
    ...(Number.isInteger(Number(s["page"])) && Number(s["page"]) > 1 ? { page: Number(s["page"]) } : {}),
  }),
  component: Listings,
});

function Listings() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const role = parent.useLoaderData().agency.role;
  const qc = useQueryClient();
  const { data, isPending, isError } = useQuery(listQuery(slug, search.status, search.q, search.page ?? 1));
  const space = useQuery({ queryKey: ["agency", slug, "space"], queryFn: () => getListingSpace({ data: { slug } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["agency", slug] }).then(() => qc.invalidateQueries({ queryKey: ["property-home"] }));
  const act = useMutation({
    mutationFn: async (a: { kind: "pause" | "freeze" | "resume" | "close-sold" | "close-let" | "close-withdrawn" | "renew"; id: string }) => {
      if (a.kind === "renew") return renewListing({ data: { slug, id: a.id } });
      if (a.kind === "pause") return setListingStatus({ data: { slug, id: a.id, to: "paused" } });
      if (a.kind === "freeze") return setListingStatus({ data: { slug, id: a.id, to: "frozen" } });
      if (a.kind === "resume") return setListingStatus({ data: { slug, id: a.id, to: "published" } });
      return setListingStatus({ data: { slug, id: a.id, to: "closed", reason: a.kind === "close-sold" ? "sold" : a.kind === "close-let" ? "let" : "withdrawn" } });
    },
    onSuccess: () => { toast.success("Done"); refresh(); },
    onError: (e) => toast.error(errorText(e)),
  });

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ ids: string[]; refs: string[] } | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ done: number; skipped: { id: string; ref: string; reason: string }[]; what: string } | null>(null);
  const [percent, setPercent] = useState("");
  const agents = useQuery({ queryKey: ["agency", slug, "agents"], queryFn: () => getAgencyAgents({ data: { slug } }), enabled: can(role, "listing.assign") });
  const bulk = useMutation({
    mutationFn: (v: BulkVars) => { const { what: _w, ...rest } = v; void _w; return bulkListingAction({ data: { slug, ...rest } as never }) as Promise<{ done: number; skipped: { id: string; ref: string; reason: string }[] }>; },
    onSuccess: (r, v) => { setSummary({ ...r, what: v.what }); setPicked(new Set()); setPending(null); setDelError(null); refresh(); },
    onError: (e, v) => { if (v.action === "delete") setDelError(errorText(e)); else toast.error(errorText(e)); },
  });
  const ids = [...picked];
  const run = (what: string, v: Omit<BulkVars, "ids" | "what">) => bulk.mutate({ ids, what, ...v });
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const download = async () => {
    const text = await exportAgencyListings({ data: { slug } }).catch((e) => { toast.error(errorText(e)); return null; });
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${slug}-listings.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const u = space.data?.usage;
  return (
    <div>
      <PageHeader title="Listings" sub="Everything your agency has listed, with its status and results." />
      {u && (
        <div className="mb-5 rounded-2xl border border-border p-4">
          <div data-tour="space-meter"><SpaceMeter usage={u} /></div>
          {(u.full || u.frozen > 0) && (
            <div className="mt-3 text-sm">
              {u.frozen > 0 && <p><strong>{u.frozen} frozen listing{u.frozen === 1 ? "" : "s"}.</strong> {u.frozenOverLimit > 0 ? "A boost or Premium package ended and you are over the free limit, so they are hidden. " : ""}Frozen listings are kept, never deleted. Boost them, add them to Premium, add space, or free up room by freezing or deleting others.</p>}
              {u.full && u.frozen === 0 && <p>You are using all your free listings. To publish more, boost a listing, buy Premium, add space, or freeze or delete one you no longer need.</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Link to="/dashboard/agency/$slug/space" params={{ slug }} className={`${btnGhost} h-9 px-3`}>Add listing space</Link>
                <Link to="/dashboard/agency/$slug/premium" params={{ slug }} className={`${btnGhost} h-9 px-3`}>Premium packages</Link>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <form className="flex flex-1 gap-2" role="search" onSubmit={(e) => { e.preventDefault(); const q = String(new FormData(e.currentTarget).get("q") ?? "").trim(); navigate({ search: (p) => ({ ...p, q: q || undefined, page: undefined }) }); }}>
          <input name="q" defaultValue={search.q ?? ""} aria-label="Search your listings" placeholder="Search title, reference or area" className={`${inputCls} max-w-sm`} />
          <div className="w-44"><Pick label="Status" clearLabel="All statuses" value={search.status ?? ""} onChange={(v) => navigate({ search: (p) => ({ ...p, status: (v || undefined) as Status | undefined, page: undefined }) })} options={STATUSES.map((s) => ({ value: s, label: s === "pending_review" ? "In review" : s[0]!.toUpperCase() + s.slice(1) }))} className="h-10" /></div>
        </form>
        <button type="button" onClick={download} className={`${btnGhost} h-10 px-3`}><Download className="h-4 w-4" aria-hidden />Export CSV</button>
        {can(role, "listing.create") && <Link to="/dashboard/agency/$slug/import" params={{ slug }} className={`${btnGhost} h-10 px-3`}><Upload className="h-4 w-4" aria-hidden />Import CSV</Link>}
        {can(role, "listing.create") && <Link data-tour="add-listing" to="/dashboard/agency/$slug/listings/$id" params={{ slug, id: "new" }} className={btnPrimary}><Plus className="h-4 w-4" aria-hidden />Add listing</Link>}
      </div>
      {isPending ? <LoaderBlock className="py-10" /> : isError ? <p role="alert" className="text-sm text-destructive">Could not load listings.</p> : !data.items.length ? (
        <div className="empty-card"><Inbox className="h-6 w-6 text-muted-foreground" aria-hidden /><p className="text-sm font-semibold text-muted-foreground">{search.status || search.q ? "No listings match." : "No listings yet. Add your first one."}</p></div>
      ) : (
        <>
          {summary && (
            <div role="status" className="mb-4 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
              <p className="font-bold">{summary.what}: {summary.done} done{summary.skipped.length ? `, ${summary.skipped.length} skipped` : ""}.</p>
              {summary.skipped.length > 0 && <ul className="mt-2 list-disc pl-5 text-muted-foreground">{summary.skipped.slice(0, 10).map((k) => <li key={k.id}>{k.ref}: {k.reason}</li>)}</ul>}
              <button type="button" onClick={() => setSummary(null)} className="mt-2 text-xs font-bold underline">Dismiss</button>
            </div>
          )}
          <div className="mb-3 flex items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2 font-semibold"><input type="checkbox" className="size-4" checked={data.items.length > 0 && data.items.every((l) => picked.has(l.id))} onChange={(e) => setPicked(e.target.checked ? new Set(data.items.filter((l) => l.canEdit).map((l) => l.id)) : new Set())} />Select all on this page</label>
            {picked.size > 0 && <span className="text-muted-foreground">{picked.size} selected</span>}
          </div>
          {picked.size > 0 && (
            <div role="region" aria-label="Actions for selected listings" className="sticky top-16 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background/95 p-3 shadow backdrop-blur">
              <span className="text-sm font-bold">{picked.size} selected</span>
              <button className={`${btnGhost} h-9 px-3`} disabled={bulk.isPending} onClick={() => run("Paused", { action: "pause" })}>Pause</button>
              <button className={`${btnGhost} h-9 px-3`} disabled={bulk.isPending} onClick={() => run("Resumed", { action: "resume" })}>Resume</button>
              <button className={`${btnGhost} h-9 px-3`} disabled={bulk.isPending} onClick={() => run("Renewed", { action: "renew" })}>Still available</button>
              <button className={`${btnGhost} h-9 px-3`} disabled={bulk.isPending} onClick={() => { if (confirm(`Mark ${picked.size} listings as sold and take them off the site?`)) run("Closed as sold", { action: "close", reason: "sold" }); }}>Mark sold</button>
              <button className={`${btnGhost} h-9 px-3`} disabled={bulk.isPending} onClick={() => { if (confirm(`Mark ${picked.size} listings as let and take them off the site?`)) run("Closed as let", { action: "close", reason: "let" }); }}>Mark let</button>
              <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const n = Number(percent); if (!Number.isFinite(n) || n === 0) { toast.error("Enter a percentage like 5 or -10"); return; } if (confirm(`Change the price of ${picked.size} listings by ${n > 0 ? "+" : ""}${n}%?`)) run(`Price changed by ${n}%`, { action: "price_percent", percent: n }); }}>
                <input aria-label="Change price by percent" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="±%" className="h-9 w-20 rounded-xl border border-input bg-background px-2 text-sm" />
                <button className={`${btnGhost} h-9 px-3`} disabled={bulk.isPending}>Change price</button>
              </form>
              {can(role, "listing.assign") && agents.data && (
                <Sel aria-label="Assign selected to an agent" defaultValue="" className="h-9 rounded-xl border border-input bg-background px-2 text-sm" onChange={(e) => { const v = e.target.value; e.target.value = ""; if (v) run("Assigned", { action: "assign_agent", agentId: v === "none" ? null : v }); }}>
                  <option value="">Assign to…</option><option value="none">Nobody</option>{agents.data.map((a) => <option key={a.userId} value={a.userId}>{a.name}</option>)}
                </Sel>
              )}
              <button className={`${btnGhost} h-9 px-3 text-destructive`} disabled={bulk.isPending} onClick={() => { setDelError(null); setPending({ ids, refs: data.items.filter((l) => picked.has(l.id)).map((l) => l.referenceCode) }); }}>Delete…</button>
              <button className="ml-auto text-xs font-bold underline" onClick={() => setPicked(new Set())}>Clear</button>
            </div>
          )}
          <ul className="space-y-3">
            {data.items.map((l) => (
              <li key={l.id} className="border border-border bg-card shadow-sm flex flex-col gap-4 rounded-2xl p-4 sm:flex-row">
                {l.canEdit && <input type="checkbox" aria-label={`Select ${l.title}`} className="mt-1 size-4 shrink-0" checked={picked.has(l.id)} onChange={() => toggle(l.id)} />}
                <div className="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-36">{l.image && <img src={l.image.thumbUrl ?? l.image.url} alt="" width={144} height={96} loading="lazy" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Badge value={l.status} /><span className="text-xs text-muted-foreground">Ref {l.referenceCode}</span></div>
                  <p className="mt-1 truncate font-bold">{l.title}</p>
                  <p className="text-sm text-muted-foreground">{formatPrice(l.price)} · {propertyTypeLabel(l.propertyType)} · {[l.areaName, l.county].filter(Boolean).join(", ")}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" aria-hidden />{l.views} views</span><span>{l.enquiries} enquiries</span>{l.expiresAt && l.status === "published" && <span>Expires {new Date(l.expiresAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</span>}<span>{l.imageCount} photos</span></p>
                  {l.status === "frozen" && <p role="note" className="mt-2 flex items-start gap-2 rounded-lg bg-sky-500/10 p-2 text-xs"><Snowflake className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{l.frozenReason === "over_limit" ? "Frozen: this listing lost its boost or Premium term and your agency is over its free limit. It is hidden but kept. Boost it, add it to Premium, or make room to bring it back." : "You froze this listing. It is hidden but kept. Bring it back when you have room."}</p>}
                  {l.status === "rejected" && l.rejectionReason && <p role="note" className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">Not approved: {l.rejectionReason}</p>}
                </div>
                {l.canEdit && (
                  <div className="flex flex-wrap items-start gap-2 sm:w-40 sm:flex-col">
                    <Link to="/dashboard/agency/$slug/listings/$id" params={{ slug, id: l.id }} className={`${btnGhost} h-9 px-3`}>Edit</Link>
                    {l.status === "published" && <>
                      <Link to="/property/$slug" params={{ slug: l.slug }} className={`${btnGhost} h-9 px-3`}>View</Link>
                      <Link to="/dashboard/agency/$slug/promote/$id" params={{ slug, id: l.id }} className={`${btnGhost} h-9 px-3`}>Boost</Link>
                      <button className={`${btnGhost} h-9 px-3`} disabled={act.isPending} onClick={() => act.mutate({ kind: "pause", id: l.id })}>Pause</button>
                      <button className={`${btnGhost} h-9 px-3`} title="Hide it and free its place. You can bring it back later." disabled={act.isPending} onClick={() => act.mutate({ kind: "freeze", id: l.id })}>Freeze</button>
                      <button className={`${btnGhost} h-9 px-3`} disabled={act.isPending} onClick={() => act.mutate({ kind: "renew", id: l.id })}>Still available</button>
                      <button className={`${btnGhost} h-9 px-3`} disabled={act.isPending} onClick={() => confirm("Mark as let or sold and take it off the site?") && act.mutate({ kind: l.listingType === "sale" ? "close-sold" : "close-let", id: l.id })}>{l.listingType === "sale" ? "Mark sold" : "Mark let"}</button>
                    </>}
                    {l.status === "paused" && <button className={`${btnGhost} h-9 px-3`} disabled={act.isPending} onClick={() => act.mutate({ kind: "resume", id: l.id })}>Resume</button>}
                    {l.status === "frozen" && <>
                      <Link to="/dashboard/agency/$slug/promote/$id" params={{ slug, id: l.id }} className={`${btnPrimary} h-9 px-3`}>Boost to relist</Link>
                      <Link to="/dashboard/agency/$slug/premium" params={{ slug }} className={`${btnGhost} h-9 px-3`}>Add to Premium</Link>
                      <button className={`${btnGhost} h-9 px-3`} disabled={act.isPending} onClick={() => act.mutate({ kind: "resume", id: l.id })}>Bring back</button>
                    </>}
                    {l.status === "expired" && <button className={`${btnPrimary} h-9 px-3`} disabled={act.isPending} onClick={() => act.mutate({ kind: "renew", id: l.id })}>Renew</button>}
                    {["draft", "rejected", "closed", "frozen"].includes(l.status) && <button className={`${btnGhost} h-9 px-3 text-destructive`} disabled={act.isPending} onClick={() => { setDelError(null); setPending({ ids: [l.id], refs: [l.referenceCode] }); }}>Delete</button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => navigate({ search: (s) => ({ ...s, page: p > 1 ? p : undefined }) })} />
        </>
      )}
      <TypedConfirm
        open={!!pending} busy={bulk.isPending} error={delError} onClose={() => setPending(null)}
        title={pending && pending.ids.length > 1 ? `Delete ${pending.ids.length} listings?` : "Delete this listing?"}
        body={pending && pending.ids.length > 1 ? <>These listings will be removed for good, with their photos and saved-by counts. Only drafts, rejected and closed listings can be deleted; others are skipped. Live listings should be closed instead so their history is kept.</> : <>This listing will be removed for good. If it was live, close it instead so its history is kept.</>}
        phrase={pending ? deletePhrase(pending.ids.length, pending.refs[0]) : ""} needPassword={!!pending && pending.ids.length > 1}
        onConfirm={({ text, password }) => pending && bulk.mutate({ ids: pending.ids, what: "Deleted", action: "delete", confirmText: text, ...(password ? { password } : {}) })}
      />
    </div>
  );
}