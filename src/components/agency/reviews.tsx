import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Flag, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Stars, StarPicker } from "@/components/agency/stars";
import { useAuth } from "@/hooks/use-auth";
import { agencyReviewsQuery, deleteMyAgencyReview, replyToAgencyReview, reportAgencyReview, submitAgencyReview } from "@/lib/agency-reviews.functions";
import { AGENCY_LIMITS } from "@/lib/mongodb/limits";
import { trustLabel } from "@/lib/review-rules";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" });

/** Ratings and written reviews for an agency. Anyone can read; signed-in people who do not work for the agency can write one and change it later. */
export function AgencyReviews({ slug, agencyName }: { slug: string; agencyName: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery(agencyReviewsQuery(slug));
  const refresh = () => qc.invalidateQueries({ queryKey: ["agency-reviews", slug] });
  const err = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");
  const ref = user?.agencies.find((a) => a.slug === slug);
  const canReply = !!ref && (ref.role === "owner" || ref.role === "admin");
  const isStaff = !!ref;

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const submit = useMutation({ mutationFn: () => submitAgencyReview({ data: { slug, rating, body } }), onSuccess: () => { toast.success("Thanks, your review is up"); setEditing(false); refresh(); }, onError: err });
  const del = useMutation({ mutationFn: (id: string) => deleteMyAgencyReview({ data: { id } }), onSuccess: () => { toast.success("Review removed"); setRating(0); setBody(""); refresh(); }, onError: err });
  const report = useMutation({ mutationFn: (id: string) => reportAgencyReview({ data: { id } }), onSuccess: () => { toast.success("Thanks. We will take a look."); refresh(); }, onError: err });
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const reply = useMutation({ mutationFn: (id: string) => replyToAgencyReview({ data: { slug, id, body: replyText } }), onSuccess: () => { setReplyFor(null); setReplyText(""); refresh(); }, onError: err });

  if (!data) return <section id="reviews" className="mt-12"><h2 className="text-2xl font-extrabold">Reviews</h2><p className="mt-3 text-sm text-muted-foreground">Loading…</p></section>;
  const s = data.summary;
  const items = data.items;
  const showForm = !!user && !isStaff && (!data.mine || editing);
  const startEdit = () => { if (data.mine) { setRating(data.mine.rating); setBody(data.mine.body); } setEditing(true); };

  return (
    <section id="reviews" className="mt-12" aria-labelledby="reviews-h">
      <h2 id="reviews-h" className="text-2xl font-extrabold">Reviews</h2>
      <div className="mt-4 grid gap-6 rounded-3xl border border-border p-5 sm:grid-cols-[12rem_1fr]">
        <div>
          <p className="text-5xl font-extrabold">{s.count ? s.avg.toFixed(1) : "–"}</p>
          <Stars value={s.avg} size={20} />
          <p className="mt-1 text-xs text-muted-foreground">{trustLabel(s.count, s.avg)}</p>
        </div>
        <ul className="space-y-1.5" aria-label="Reviews by star rating">
          {[5, 4, 3, 2, 1].map((n) => (
            <li key={n} className="flex items-center gap-2 text-xs"><span className="w-10">{n} star{n > 1 && "s"}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-amber-400" style={{ width: `${s.count ? (s.distribution[n - 1]! / s.count) * 100 : 0}%` }} /></span>
              <span className="w-6 text-right text-muted-foreground">{s.distribution[n - 1]}</span></li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        {!user ? <p className="text-sm"><Link to="/auth" search={{ redirect: `/agency/${slug}` }} className="font-bold text-primary underline">Sign in</Link> to review {agencyName}.</p>
          : isStaff ? <p className="text-sm text-muted-foreground">You work for this agency, so you can answer reviews but not write one.</p>
          : showForm ? (
            <form onSubmit={(e) => { e.preventDefault(); if (!rating) { toast.error("Choose a star rating"); return; } submit.mutate(); }} className="space-y-3 rounded-2xl border border-border p-4">
              <p id="rate-l" className="text-sm font-bold">{data.mine ? "Edit your review" : `How was your experience with ${agencyName}?`}</p>
              <StarPicker id="rate-l" value={rating} onChange={setRating} />
              <label className="block text-sm font-bold" htmlFor="rev-body">Your review</label>
              <textarea id="rev-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={AGENCY_LIMITS.reviewBodyMax} required minLength={10} placeholder="What did they do well? What could be better? Stick to your own experience." className="w-full rounded-xl border border-input bg-background p-3 text-sm" />
              <div className="flex gap-2"><button disabled={submit.isPending} className="h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">{submit.isPending ? "Saving…" : data.mine ? "Save changes" : "Post review"}</button>{editing && <button type="button" onClick={() => setEditing(false)} className="h-11 rounded-full border border-input px-5 text-sm font-bold">Cancel</button>}</div>
            </form>
          ) : data.mine && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted/40 p-4 text-sm">
              <span>{data.mine.status === "hidden" ? "Your review is hidden while we check it." : "You reviewed this agency."}</span>
              <button type="button" onClick={startEdit} className="font-bold underline">Edit</button>
              <button type="button" onClick={() => { if (window.confirm("Delete your review?")) del.mutate(data.mine!.id); }} className="inline-flex items-center gap-1 font-bold text-destructive"><Trash2 className="size-4" aria-hidden />Delete</button>
            </div>
          )}
      </div>

      <ul className="mt-6 space-y-5">
        {items.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Stars value={r.rating} /><span className="font-bold">{r.username}</span>
              {r.verifiedEnquirer && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400"><BadgeCheck className="size-4" aria-hidden />Contacted this agency</span>}
              <span className="text-xs text-muted-foreground">{when(r.createdAt)}{r.edited && " · edited"}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{r.body}</p>
            {r.reply && <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm"><p className="text-xs font-bold">Reply from {agencyName} · {when(r.reply.at)}</p><p className="mt-1 whitespace-pre-line">{r.reply.body}</p></div>}
            <div className="mt-2 flex flex-wrap gap-4 text-xs">
              {canReply && <button type="button" onClick={() => { setReplyFor(replyFor === r.id ? null : r.id); setReplyText(r.reply?.body ?? ""); }} className="font-bold underline">{r.reply ? "Edit reply" : "Reply"}</button>}
              {user && !r.mine && !isStaff && (r.reported ? <span className="text-muted-foreground">Reported</span> : <button type="button" onClick={() => { if (window.confirm("Report this review as unfair, fake or abusive?")) report.mutate(r.id); }} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Flag className="size-3.5" aria-hidden />Report</button>)}
            </div>
            {replyFor === r.id && (
              <form onSubmit={(e) => { e.preventDefault(); reply.mutate(r.id); }} className="mt-3 space-y-2">
                <label className="sr-only" htmlFor={`rp-${r.id}`}>Your reply</label>
                <textarea id={`rp-${r.id}`} value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} maxLength={AGENCY_LIMITS.reviewBodyMax} required className="w-full rounded-xl border border-input bg-background p-3 text-sm" />
                <button disabled={reply.isPending} className="h-10 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">Post reply</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {data.hasMore && <p className="mt-4 text-xs text-muted-foreground">Showing the {items.length} most recent reviews.</p>}
    </section>
  );
}
