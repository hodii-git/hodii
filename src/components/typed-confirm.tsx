import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { phraseMatches } from "@/lib/bulk-rules";

/**
 * For things that cannot be undone. Step 1 says what will happen; step 2 asks the person to type a phrase
 * (and, when asked, their password) before the final button works. Nothing is deleted by a stray click.
 */
export function TypedConfirm({ open, title, body, phrase, needPassword = false, confirmLabel = "Delete for good", busy = false, error, onConfirm, onClose }: {
  open: boolean; title: string; body: ReactNode; phrase: string; needPassword?: boolean; confirmLabel?: string; busy?: boolean; error?: string | null;
  onConfirm: (v: { text: string; password: string }) => void; onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [text, setText] = useState("");
  const [password, setPassword] = useState("");
  useEffect(() => { if (open) { setStep(1); setText(""); setPassword(""); } }, [open]);
  const ready = phraseMatches(text, phrase) && (!needPassword || password.length > 0);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-transparent" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-background p-6 shadow-xl">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-600"><AlertTriangle className="size-5" aria-hidden /></span>
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-extrabold">{step === 1 ? title : "Are you completely sure?"}</Dialog.Title>
              <Dialog.Description asChild><div className="mt-1 text-sm text-muted-foreground">{step === 1 ? body : <>This cannot be undone. To go ahead, type <strong className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{phrase}</strong> below.</>}</div></Dialog.Description>
            </div>
          </div>
          {step === 2 && (
            <form className="mt-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); if (ready && !busy) onConfirm({ text, password }); }}>
              <label className="text-sm font-bold" htmlFor="tc-text">Type {phrase}</label>
              <input id="tc-text" autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 font-mono text-sm" />
              {needPassword && <><label className="text-sm font-bold" htmlFor="tc-pw">Your password</label>
                <input id="tc-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm" /></>}
              {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
              <div className="mt-1 flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={onClose} className="h-11 rounded-full border border-input px-5 text-sm font-bold">Cancel</button>
                <button disabled={!ready || busy} className="h-11 rounded-full bg-red-600 px-5 text-sm font-bold text-white disabled:opacity-40">{busy ? "Working…" : confirmLabel}</button>
              </div>
            </form>
          )}
          {step === 1 && (
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-11 rounded-full border border-input px-5 text-sm font-bold">Cancel</button>
              <button type="button" onClick={() => setStep(2)} className="h-11 rounded-full bg-red-600 px-5 text-sm font-bold text-white">Continue</button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
