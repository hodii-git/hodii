import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Bug, CircleHelp, Heart, Lightbulb, MessageCircle, Star, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { sendFeedback } from "@/lib/feedback.functions";
import { useAuth } from "@/hooks/use-auth";

const KINDS = [
  { key: "like", label: "I like something", hint: "Tell us what works", icon: Heart },
  { key: "idea", label: "I have an idea", hint: "A feature or change you would like", icon: Lightbulb },
  { key: "confusing", label: "Something is confusing", hint: "You could not find or understand it", icon: CircleHelp },
  { key: "bug", label: "Something is broken", hint: "A button, page or form that does not work", icon: Bug },
  { key: "down", label: "Site down or very slow", hint: "Errors, blank pages, long waits", icon: WifiOff },
  { key: "other", label: "Something else", hint: "Anything at all", icon: MessageCircle },
] as const;
type Kind = (typeof KINDS)[number]["key"];

const PROMPT: Record<Kind, string> = {
  like: "What do you like? What should we keep?",
  idea: "What would you like us to add or change?",
  confusing: "What were you trying to do, and what confused you?",
  bug: "What were you doing, what did you expect, and what happened instead?",
  down: "What is not loading, and roughly when did it start?",
  other: "What would you like to tell us?",
};

/** The feedback form, used in the floating window and on the feedback page. Sends the page the person was on and their screen size, nothing else about their device. */
export function FeedbackForm({ onDone, from }: { onDone?: () => void; from?: string }) {
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [kind, setKind] = useState<Kind | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = useMutation({
    mutationFn: () => sendFeedback({ data: { kind: kind!, rating, message, page: from ?? path, viewport: typeof window === "undefined" ? null : `${window.innerWidth}x${window.innerHeight}`, email, name: user?.username ?? "", contactOk, website } }),
    onSuccess: (r) => { if (r.ok) { setSent(true); toast.success("Thank you. Your feedback reached the team."); } else setError(r.error); },
    onError: () => setError("Could not send it. Please try again in a moment."),
  });

  if (sent) {
    return (
      <div role="status" className="rounded-2xl bg-primary/10 p-6 text-center">
        <p className="text-lg font-extrabold">Thank you!</p>
        <p className="mt-1 text-sm text-muted-foreground">Every message is read by the team. {contactOk ? "We may get back to you." : ""}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={() => { setSent(false); setKind(null); setMessage(""); setRating(null); setError(null); }} className="rounded-full border border-input px-4 py-2 text-sm font-semibold">Send another</button>
          {onDone && <button type="button" onClick={onDone} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Close</button>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(null); if (!kind) { setError("Choose what this is about first."); return; } if (message.trim().length < 3) { setError("Please write a few words."); return; } send.mutate(); }} className="space-y-5" noValidate>
      <div role="note" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <p className="font-bold">Hodii is still under development.</p>
        <p className="mt-1">You are using it while we build and fix it. We appreciate any feedback, good or bad. If something is broken, not working, or the site was down, please tell us so we can fix it quickly.</p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-bold">What is it about?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map(({ key, label, hint, icon: Icon }) => (
            <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm transition focus-within:ring-2 focus-within:ring-ring ${kind === key ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}>
              <input type="radio" name="fb-kind" value={key} checked={kind === key} onChange={() => setKind(key)} className="sr-only" />
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span><span className="block font-bold">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      {kind && (
        <>
          <div>
            <label htmlFor="fb-msg" className="mb-1.5 block text-sm font-bold">{PROMPT[kind]}</label>
            <textarea id="fb-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={5} className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
            <p className="mt-1 text-xs text-muted-foreground">We also send the page you are on ({from ?? path}) and your screen size, to help us find the problem.</p>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-bold">How is your experience so far? <span className="font-normal text-muted-foreground">(optional)</span></legend>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(rating === n ? null : n)} className="rounded p-1 focus-visible:ring-2 focus-visible:ring-ring">
                  <Star className={`h-7 w-7 ${rating !== null && n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} aria-hidden />
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} className="mt-1 size-4" />You may contact me about this</label>
            {contactOk && (
              <div>
                <label htmlFor="fb-email" className="mb-1 block text-sm font-semibold">Email {user?.email ? "(leave empty to use your account email)" : ""}</label>
                <input id="fb-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" />
              </div>
            )}
          </div>
          <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label></div>
        </>
      )}

      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <button type="submit" disabled={send.isPending || !kind} className="h-11 w-full rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground disabled:opacity-50">{send.isPending ? "Sending…" : "Send feedback"}</button>
    </form>
  );
}
