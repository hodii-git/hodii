import { Loader } from "@/components/loader";
import { VoiceButton } from "@/components/property/voice-button";
import { LoaderBlock } from "@/components/loader";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Stars, StarPicker } from "@/components/agency/stars";
import { Pick } from "@/components/ui/pick";
import { errorText } from "@/components/dashboard/ui";
import { ASPECTS, NB_LIMITS, RELATIONS, viewReviews, type ReviewSort, type Ratings, type Summary } from "@/lib/neighbourhood";
import { deleteNeighbourhoodReview, myStateQuery, neighbourhoodQuery, postToNeighbourhood, postsQuery, removeNeighbourhoodPost, reportNeighbourhoodItem, saveNeighbourhoodReview } from "@/lib/neighbourhoods.functions";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
export const Avatar = ({ name, hue }: { name: string; hue: number }) => <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: `hsl(${hue} 45% 40%)` }}>{name.slice(0, 1).toUpperCase()}</span>;

/** One bar per aspect with its average, so people can see where an area is strong or weak. */
export function RatingBars({ s }: { s: Summary }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {ASPECTS.map((a) => { const r = s.aspects[a.key]; return (
        <li key={a.key} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 font-semibold">{a.label}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${r ? (r.avg / 5) * 100 : 0}%` }} /></span>
          <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">{r ? `${r.avg.toFixed(1)} (${r.n})` : "No ratings"}</span>
        </li>
      ); })}
    </ul>
  );
}

/** "Report" for someone else's review or message. Asks first, because three reports hide it. */
export function ReportButton({ kind, id, signedIn }: { kind: "review" | "post"; id: string; signedIn: boolean }) {
  const [sent, setSent] = useState(false);
  const m = useMutation({ mutationFn: () => reportNeighbourhoodItem({ data: { kind, id } }), onSuccess: () => { setSent(true); toast.success("Thanks. Our team will look at it."); }, onError: (e) => toast.error(errorText(e)) });
  if (!signedIn) return null;
  return <button type="button" disabled={sent || m.isPending} onClick={() => { if (window.confirm("Report this as abusive, a scam or against our rules?")) m.mutate(); }} className="text-muted-foreground hover:underline disabled:no-underline">{sent ? "Reported" : "Report"}</button>;
}

export function SignInNote({ path, action }: { path: string; action: string }) {
  return <p className="rounded-2xl border border-dashed border-border p-4 text-sm"><Link to="/auth" search={{ redirect: path }} className="font-bold text-primary underline">Sign in</Link> to {action}.</p>;
}

export function ReviewForm({ areaKey, path }: { areaKey: string; path: string }) {
  const qc = useQueryClient();
  const { data: me, isPending } = useQuery(myStateQuery(areaKey));
  const [ratings, setRatings] = useState<Ratings | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [relation, setRelation] = useState<string | null>(null);
  if (isPending) return <LoaderBlock className="py-10" />;
  if (!me) return <SignInNote path={path} action="rate this neighbourhood" />;
  const r = ratings ?? me.review?.ratings ?? {}, t = text ?? me.review?.text ?? "", rel = relation ?? me.review?.relation ?? "live";
  const done = () => { void qc.invalidateQueries({ queryKey: ["neighbourhood", areaKey] }); void qc.invalidateQueries({ queryKey: ["neighbourhoods"] }); };
  const save = useMutation({ mutationFn: () => saveNeighbourhoodReview({ data: { areaKey, ratings: r as never, text: t, relation: rel as never } }), onSuccess: () => { toast.success("Thanks, your review is saved"); done(); }, onError: (e) => toast.error(errorText(e)) });
  const del = useMutation({ mutationFn: () => deleteNeighbourhoodReview({ data: { key: areaKey } }), onSuccess: () => { toast.success("Review removed"); setRatings({}); setText(""); done(); }, onError: (e) => toast.error(errorText(e)) });
  const any = Object.values(r).some(Boolean);
  return (
    <form className="grid gap-4 rounded-3xl border border-border p-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <h3 className="text-lg font-extrabold">{me.review ? "Your review" : "Rate this neighbourhood"}</h3>
      <p className="text-sm text-muted-foreground">Rate what you know. You can skip anything you are not sure about.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ASPECTS.map((a) => (
          <div key={a.key}><p id={`r-${a.key}`} className="text-sm font-bold">{a.label}</p><p className="text-xs text-muted-foreground">{a.hint}</p>
            <StarPicker id={`r-${a.key}`} value={r[a.key] ?? 0} onChange={(n) => setRatings({ ...r, [a.key]: n })} /></div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <div><p className="mb-1 text-sm font-bold">Your connection</p><Pick label="Your connection" value={rel} onChange={(v) => setRelation(v)} options={RELATIONS.map((x) => ({ value: x.key, label: x.label }))} /></div>
        <div><label htmlFor="nb-text" className="mb-1 block text-sm font-bold">What is it like? <span className="font-normal text-muted-foreground">(optional)</span></label>
          <textarea id="nb-text" rows={3} maxLength={NB_LIMITS.reviewMax} value={t} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50" disabled={!any || save.isPending}>{save.isPending ? <Loader size="xs" label="Saving" /> : me.review ? "Update review" : "Post review"}</button>
        {me.review && <button type="button" className="h-11 rounded-xl border border-input px-5 text-sm font-bold" disabled={del.isPending} onClick={() => del.mutate()}>Delete my review</button>}
      </div>
    </form>
  );
}

export function Reviews({ areaKey }: { areaKey: string }) {
  const { data } = useQuery(neighbourhoodQuery(areaKey));
  const { data: me } = useQuery(myStateQuery(areaKey));
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [relation, setRelation] = useState("");
  const [aspect, setAspect] = useState("");
  const [q, setQ] = useState("");
  if (!data) return null;
  if (!data.reviews.length) return <div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">No reviews yet. Be the first to share what it is like.</p></div>;
  const shown = viewReviews(data.reviews, { sort, relation: relation || undefined, q, aspect: (aspect || undefined) as never });
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter reviews">
        <div className="relative min-w-40 flex-1"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reviews" aria-label="Search reviews" className="h-10 w-full rounded-full border border-input bg-background pl-4 pr-12 text-sm" /><VoiceButton onText={setQ} /></div>
        <Pick label="Sort" value={sort} onChange={(v) => setSort(v as ReviewSort)} options={[{ value: "newest", label: "Newest" }, { value: "highest", label: "Highest rated" }, { value: "lowest", label: "Lowest rated" }]} />
        <Pick label="Connection" clearLabel="Everyone" value={relation} onChange={setRelation} options={RELATIONS.map((x) => ({ value: x.key, label: x.label }))} />
        <Pick label="About" clearLabel="Anything" value={aspect} onChange={setAspect} options={ASPECTS.map((a) => ({ value: a.key, label: a.label }))} />
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">{shown.length} of {data.reviews.length} {data.reviews.length === 1 ? "review" : "reviews"}</p>
      {shown.length === 0 ? <div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">No reviews match. Clear a filter.</p></div> : (
        <ul className="grid gap-3">
          {shown.map((r) => {
            const vals = Object.values(r.ratings).filter((x): x is number => typeof x === "number"), avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
            return (
              <li key={r.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2"><Avatar name={r.author.username} hue={r.author.hue} /><span className="font-bold">{r.author.username}</span><span className="text-xs text-muted-foreground">{RELATIONS.find((x) => x.key === r.relation)?.label} · {when(r.at)}</span><span className="ml-auto inline-flex items-center gap-1"><Stars value={avg} size={14} /><span className="text-sm font-bold">{avg.toFixed(1)}</span></span></div>
                {r.text && <p className="mt-2 whitespace-pre-line break-words text-sm">{r.text}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{ASPECTS.filter((a) => r.ratings[a.key]).map((a) => <span key={a.key}>{a.label} {r.ratings[a.key]}/5</span>)}{me?.review?.id !== r.id && <span className="ml-auto text-xs font-bold"><ReportButton kind="review" id={r.id} signedIn={!!me} /></span>}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type Post = { id: string; parentId: string | null; at: string; deleted: boolean; text: string; author: { username: string; hue: number } };
export function Chat({ areaKey, path, name }: { areaKey: string; path: string; name: string }) {
  const qc = useQueryClient();
  const { data: posts = [] } = useQuery(postsQuery(areaKey));
  const { data: me } = useQuery(myStateQuery(areaKey));
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["neighbourhood", areaKey, "posts"] }); void qc.invalidateQueries({ queryKey: ["neighbourhood", areaKey, "me"] }); };
  const send = useMutation({ mutationFn: () => postToNeighbourhood({ data: { key: areaKey, text, parentId: replyTo } }), onSuccess: () => { setText(""); setReplyTo(null); refresh(); }, onError: (e) => toast.error(errorText(e)) });
  const del = useMutation({ mutationFn: (id: string) => removeNeighbourhoodPost({ data: { id } }), onSuccess: refresh, onError: (e) => toast.error(errorText(e)) });
  const kids = (id: string | null) => posts.filter((p: Post) => p.parentId === id);
  const mine = new Set(me?.postIds ?? []);
  const Node = ({ p, depth }: { p: Post; depth: number }) => (
    <li className={depth ? "mt-3 border-l-2 border-border pl-3" : "rounded-2xl border border-border p-4"}>
      {p.deleted ? <p className="text-sm italic text-muted-foreground">This message was removed.</p> : (
        <>
          <div className="flex items-center gap-2"><Avatar name={p.author.username} hue={p.author.hue} /><span className="text-sm font-bold">{p.author.username}</span><span className="text-xs text-muted-foreground">{when(p.at)}</span></div>
          <p className="mt-1 whitespace-pre-line break-words text-sm">{p.text}</p>
          <p className="mt-1 flex gap-3 text-xs font-bold">{me && depth < NB_LIMITS.replyDepth - 1 && <button type="button" className="text-primary hover:underline" onClick={() => setReplyTo(p.id)}>Reply</button>}{mine.has(p.id) ? <button type="button" className="text-muted-foreground hover:underline" onClick={() => del.mutate(p.id)}>Delete</button> : <ReportButton kind="post" id={p.id} signedIn={!!me} />}</p>
        </>
      )}
      {kids(p.id).length > 0 && <ul>{kids(p.id).map((c: Post) => <Node key={c.id} p={c} depth={depth + 1} />)}</ul>}
    </li>
  );
  const parent = replyTo ? posts.find((p: Post) => p.id === replyTo) : null;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">Talk with people who live in or know {name}: ask about water, security, the best schools, new places to eat. Be kind and do not share anyone's private details.</p>
      {me ? (
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(); }}>
          {parent && <p className="text-xs text-muted-foreground">Replying to {parent.author.username} · <button type="button" className="font-bold text-primary" onClick={() => setReplyTo(null)}>cancel</button></p>}
          <label htmlFor="nb-chat" className="sr-only">Your message</label>
          <textarea id="nb-chat" rows={3} maxLength={NB_LIMITS.postMax} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Say something to ${name}…`} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" />
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{text.length}/{NB_LIMITS.postMax}</span><button className="h-10 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50" disabled={!text.trim() || send.isPending}>{send.isPending ? <Loader size="xs" label="Sending" /> : "Send"}</button></div>
        </form>
      ) : <SignInNote path={path} action="join the conversation" />}
      {posts.length === 0 ? <div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">No messages yet. Start the conversation.</p></div> : <ul className="grid gap-3">{kids(null).map((p: Post) => <Node key={p.id} p={p} depth={0} />)}</ul>}
    </div>
  );
}
