import { LoaderBlock } from "@/components/loader";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sel } from "@/components/ui/sel";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, areaCls, btnGhost, errorText, inputCls, label, PageHeader } from "@/components/dashboard/ui";
import { Pager } from "@/components/property/results";
import { EnquiryThread } from "@/components/enquiry-thread";
import { getAgencyEnquiries, getAgencyThread, replyAsAgency, updateAgencyEnquiry } from "@/lib/dashboard.functions";
import { ENQUIRY_STATUSES } from "@/lib/mongodb/taxonomy";
import { timeAgo } from "@/lib/format";

type Status = (typeof ENQUIRY_STATUSES)[number];
const q = (slug: string, status: Status | undefined, page: number) => queryOptions({ queryKey: ["agency", slug, "enquiries", status ?? null, page], queryFn: () => getAgencyEnquiries({ data: { slug, ...(status ? { status } : {}), page } }), refetchInterval: 30_000 });

export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/enquiries")({
  validateSearch: (s): { status?: Status | undefined; page?: number | undefined } => ({ ...(ENQUIRY_STATUSES.includes(s["status"] as Status) ? { status: s["status"] as Status } : {}), ...(Number(s["page"]) > 1 ? { page: Math.floor(Number(s["page"])) } : {}) }),
  component: Enquiries,
});

function Enquiries() {
  const { slug } = Route.useParams();
  const { status, page = 1 } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const { data, isPending, isError, error } = useQuery(q(slug, status, page));
  const update = useMutation({
    mutationFn: (v: { id: string; status?: Status; note?: string }) => updateAgencyEnquiry({ data: { slug, ...v } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agency", slug] }); },
    onError: (e) => toast.error(errorText(e)),
  });
  const [open, setOpen] = useState<string | null>(null);
  const [chat, setChat] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Enquiries" sub="People who asked about your listings. Move each one along as you speak to them." />
      <div className="mb-5 flex gap-1 overflow-x-auto">
        {[undefined, ...ENQUIRY_STATUSES].map((s) => <button key={s ?? "all"} type="button" aria-pressed={status === s} onClick={() => navigate({ search: s ? { status: s } : {} })} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold ${status === s ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>{s ? label(s) : "All"}</button>)}
      </div>
      {isPending ? <LoaderBlock className="py-10" /> : isError ? <p role="alert" className="text-sm text-destructive">{errorText(error, "Could not load enquiries.")}</p> : !data.items.length ? <div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">No enquiries here yet.</p></div> : (
        <>
          <ul className="space-y-3">
            {data.items.map((e) => (
              <li key={e.id} className="border border-border bg-card shadow-sm rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-bold">{e.name}</p><p className="text-xs text-muted-foreground">About {e.propertyTitle} (ref {e.propertyRef}) · {timeAgo(e.createdAt)}</p></div>
                  <Badge value={e.status} />
                </div>
                <p className="mt-3 whitespace-pre-line text-sm">{e.message}</p>
                {e.preferredViewingAt && <p className="mt-2 text-xs text-muted-foreground">Would like to view: {new Date(e.preferredViewingAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a href={`mailto:${e.email}`} className={`${btnGhost} h-9 px-3`}><Mail className="h-4 w-4" aria-hidden />{e.email}</a>
                  {e.phone && <a href={`tel:${e.phone}`} className={`${btnGhost} h-9 px-3`}><Phone className="h-4 w-4" aria-hidden />{e.phone}</a>}
                  <Sel aria-label="Change status" value={e.status} onChange={(ev) => update.mutate({ id: e.id, status: ev.target.value as Status })} className={`${inputCls} h-9 w-36`}>{ENQUIRY_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Sel>
                  <button type="button" aria-expanded={chat === e.id} className="text-sm font-semibold text-primary" onClick={() => setChat(chat === e.id ? null : e.id)}>{chat === e.id ? "Hide conversation" : "Conversation"}</button>
                  <button type="button" className="text-sm font-semibold text-primary" onClick={() => setOpen(open === e.id ? null : e.id)}>{e.notes.length ? `Notes (${e.notes.length})` : "Add note"}</button>
                </div>
                {chat === e.id && (
                  <div className="mt-3 border-t border-border pt-3">
                    <EnquiryThread queryKey={["agency", slug, "thread", e.id]} load={() => getAgencyThread({ data: { slug, enquiryId: e.id } })} send={(body) => replyAsAgency({ data: { slug, enquiryId: e.id, body } })} placeholder="Reply to this person. They will see it in their Hodii account." />
                  </div>
                )}
                {open === e.id && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {e.notes.map((n) => <p key={n.id} className="rounded-lg bg-muted p-2 text-sm">{n.text} <span className="text-xs text-muted-foreground">· {timeAgo(n.createdAt)}</span></p>)}
                    <form onSubmit={(ev) => { ev.preventDefault(); const t = String(new FormData(ev.currentTarget).get("note") ?? "").trim(); if (t) { update.mutate({ id: e.id, note: t }); ev.currentTarget.reset(); } }} className="flex gap-2">
                      <label htmlFor={`n-${e.id}`} className="sr-only">Note</label><textarea id={`n-${e.id}`} name="note" rows={2} maxLength={500} className={areaCls} placeholder="Private note for your team" /><button className={`${btnGhost} h-auto`}>Save</button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => navigate({ search: (s) => ({ ...s, page: p > 1 ? p : undefined }) })} />
        </>
      )}
    </div>
  );
}
