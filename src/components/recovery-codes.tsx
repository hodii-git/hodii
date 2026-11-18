import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";

/** One-time codes shown once. They are the only way back into the account if the password is forgotten, because Hodii sends no email. */
export function RecoveryCodes({ codes, onDone, doneLabel = "I have saved them" }: { codes: string[]; onDone: () => void; doneLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const text = `Hodii recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`;
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setSaved(true); } catch { /* copy blocked */ } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "hodii-recovery-codes.txt"; a.click(); URL.revokeObjectURL(url); setSaved(true);
  };
  return (
    <div className="grid gap-4">
      <h2 className="text-center font-serif text-3xl">Save your recovery codes</h2>
      <p className="text-center text-sm text-muted-foreground">If you forget your password, one of these codes lets you back in. Each works once. We cannot show them again, so keep them somewhere safe.</p>
      <ul className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-muted/40 p-4 font-mono text-sm font-bold" aria-label="Recovery codes">
        {codes.map((c) => <li key={c} className="text-center tracking-wider">{c}</li>)}
      </ul>
      <div className="flex gap-2">
        <button type="button" onClick={copy} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-input text-sm font-bold">{copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}{copied ? "Copied" : "Copy"}</button>
        <button type="button" onClick={download} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-input text-sm font-bold"><Download className="size-4" aria-hidden />Download</button>
      </div>
      <button type="button" onClick={onDone} className="h-12 rounded-full bg-primary text-base font-bold text-primary-foreground">{saved ? doneLabel : `${doneLabel} anyway`}</button>
    </div>
  );
}
