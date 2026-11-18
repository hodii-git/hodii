import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { aiSearch } from "@/lib/ai-search.functions";
import { useAuth } from "@/hooks/use-auth";
import type { SearchParams } from "@/lib/listing-search";
import type { Turn } from "@/lib/ai-criteria";
import { aiStatusQuery, useCountdown } from "./ai-allowance";

/** Every filter an AI answer can set. Applying an answer clears the ones it leaves out, so the filters always match what was understood. */
export const CRITERIA_KEYS = ["q", "listingType", "propertyTypes", "countyCodes", "priceMin", "priceMax", "bedroomsMin", "bathroomsMin", "features", "furnishing", "verifiedOnly"] as const;
export const pickCriteria = (p: Partial<SearchParams>) => Object.fromEntries(CRITERIA_KEYS.flatMap((k) => (p[k] === undefined ? [] : [[k, p[k]]])));
export const replaceCriteria = (c: Record<string, unknown>): Partial<SearchParams> => ({ ...Object.fromEntries(CRITERIA_KEYS.map((k) => [k, undefined])), ...c, page: 1 }) as Partial<SearchParams>;

type Props = { value: SearchParams; text: string; onApply: (next: Partial<SearchParams>) => void };

/** "Ask AI" for the search bar: `button` goes beside Search, `extra` below the row.
 * Original note: "Ask AI" for the search bar: understands a sentence, fills the filters (which stay editable), and takes follow-ups. */
export function useAiSearch({ value, text, onApply }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [history, setHistory] = useState<Turn[]>([]);
  const [follow, setFollow] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [out, setOut] = useState<{ resetsAt: string | null; limit: number } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const cd = useCountdown(out?.resetsAt);

  const run = useMutation({
    mutationFn: (t: string) => aiSearch({ data: { text: t, current: pickCriteria(value), history } }),
    onSuccess: (r, t) => {
      void qc.invalidateQueries({ queryKey: aiStatusQuery.queryKey });
      if (!r.ok) { setOut({ resetsAt: r.status.resetsAt, limit: r.status.limit }); return; }
      setHistory((h) => [...h, { role: "user", content: t }, { role: "assistant", content: r.reply }].slice(-8) as Turn[]);
      setReply(r.reply);
      setRemaining(r.source === "ai" ? r.status.remaining : null);
      onApply(replaceCriteria(r.criteria as Record<string, unknown>));
      setFollow("");
    },
    onError: () => toast.error("AI search is not available right now. Normal search still works."),
  });
  const ask = (t: string) => { if (t.trim().length >= 2 && !run.isPending) run.mutate(t.trim()); };

  const button = (
      <button type="button" disabled={run.isPending || text.trim().length < 2} onClick={() => { setHistory([]); ask(text); }}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-bold text-primary disabled:opacity-50" title="Describe what you want in your own words">
        <Sparkles className="h-4 w-4" aria-hidden />{run.isPending ? "Thinking…" : "Ask AI"}
      </button>
  );
  const extra = (
    <>
      {reply && (
        <div className="mt-4 mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm" role="status">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="flex-1">{reply} <span className="text-muted-foreground">The filters were set from your words. Open Filters to change any of them.</span></p>
            <button type="button" aria-label="Dismiss" onClick={() => { setReply(null); setHistory([]); }} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(follow); }}>
            <label htmlFor="ai-follow" className="sr-only">Refine your search</label>
            <input id="ai-follow" value={follow} onChange={(e) => setFollow(e.target.value)} maxLength={300} placeholder="Refine it: “cheaper”, “with parking”, “only Westlands”…" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
            <button type="submit" disabled={run.isPending || follow.trim().length < 2} className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Refine</button>
          </form>
          {remaining !== null && <p className="mt-1.5 text-xs text-muted-foreground">{remaining} AI search{remaining === 1 ? "" : "es"} left.</p>}
        </div>
      )}

      <Dialog open={out !== null} onOpenChange={(o) => { if (!o) setOut(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You have used your AI searches</DialogTitle>
            <DialogDescription>
              {user ? "Your AI searches are used up for now." : "Visitors get a few AI searches. Sign in for more."} Normal search with filters is still free and unlimited, and your last filters are still on the page.
            </DialogDescription>
          </DialogHeader>
          {cd.text && cd.left !== 0 && <p className="rounded-xl bg-muted p-4 text-center"><span className="block font-mono text-3xl font-extrabold tabular-nums">{cd.text}</span><span className="text-xs font-semibold text-muted-foreground">until they come back</span></p>}
          {cd.left === 0 && <p className="text-sm font-semibold">Your AI searches are back. Try again.</p>}
          {!user && <Link to="/auth" className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-bold text-primary-foreground">Sign in or create an account</Link>}
        </DialogContent>
      </Dialog>
    </>
  );
  return { button, extra, ask: (t: string) => { setHistory([]); ask(t); } };
}
