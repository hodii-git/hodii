import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileUp, XCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { btnGhost, btnPrimary, errorText, PageHeader } from "@/components/dashboard/ui";
import { MAX_IMPORT_ROWS, TEMPLATE_EXAMPLE, TEMPLATE_HEADERS, planImport } from "@/lib/bulk-import";
import { parseCsvRecords, toCsv } from "@/lib/csv";
import { commitListingImport } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/import")({ head: () => ({ meta: [{ title: "Import listings | Hodii" }, { name: "robots", content: "noindex" }] }), component: ImportPage });

type Done = Awaited<ReturnType<typeof commitListingImport>>;

function ImportPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const plan = useMemo(() => { if (text === null) return null; const { headers, records } = parseCsvRecords(text); return planImport(headers, records); }, [text]);
  const good = plan?.rows.filter((r) => r.ok).length ?? 0;
  const bad = (plan?.rows.length ?? 0) - good;

  const template = () => {
    const url = URL.createObjectURL(new Blob([toCsv([[...TEMPLATE_HEADERS], TEMPLATE_EXAMPLE])], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "hodii-listings-template.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const pick = async (f: File) => {
    setDone(null);
    if (f.size > 1_400_000) { toast.error("That file is too large. Split it into files of up to 200 listings."); return; }
    setFileName(f.name); setText(await f.text());
  };
  const commit = async () => {
    if (!text) return;
    setBusy(true);
    try { const r = await commitListingImport({ data: { slug, text } }); setDone(r); setText(null); qc.invalidateQueries({ queryKey: ["agency", slug] }); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Import listings from a spreadsheet</h1>
        <p className="mt-1 text-muted-foreground">Add up to {MAX_IMPORT_ROWS} listings at once. They are saved as <strong>drafts</strong>: photos must be uploaded from your device, so open each draft, add its photos and publish. Importing never publishes anything.</p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-3">
        <li className="rounded-2xl border border-border p-4"><p className="text-xs font-bold text-primary">1</p><p className="font-bold">Get the template</p><button type="button" onClick={template} className={`${btnGhost} mt-2 h-9 px-3`}><Download className="h-4 w-4" aria-hidden />Template (CSV)</button></li>
        <li className="rounded-2xl border border-border p-4"><p className="text-xs font-bold text-primary">2</p><p className="font-bold">Fill it in</p><p className="mt-1 text-xs text-muted-foreground">Excel and Google Sheets can save as CSV. Keep the header row. Separate features with semicolons.</p></li>
        <li className="rounded-2xl border border-border p-4"><p className="text-xs font-bold text-primary">3</p><p className="font-bold">Check and import</p><p className="mt-1 text-xs text-muted-foreground">You see every problem before anything is saved.</p></li>
      </ol>

      {!done && (
        <div>
          <input ref={input} type="file" accept=".csv,text/csv" hidden aria-label="Choose a CSV file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ""; }} />
          <button type="button" onClick={() => input.current?.click()} className={btnPrimary}><FileUp className="h-4 w-4" aria-hidden />{fileName ? "Choose a different file" : "Choose CSV file"}</button>
          {fileName && <span className="ml-3 text-sm text-muted-foreground">{fileName}</span>}
        </div>
      )}

      {plan && !done && (
        <div className="space-y-4">
          {plan.headerProblems.map((p) => <p key={p} role="alert" className="rounded-xl bg-amber-500/10 p-3 text-sm">{p}</p>)}
          {plan.tooMany && <p role="alert" className="rounded-xl bg-amber-500/10 p-3 text-sm">Only the first {MAX_IMPORT_ROWS} rows are read. Import the rest in another file.</p>}
          {plan.rows.length > 0 && <>
            <p className="font-bold" aria-live="polite">{good} ready to import{bad ? `, ${bad} with problems (these are skipped)` : ""}</p>
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {plan.rows.map((r) => (
                <li key={r.row} className="flex gap-3 p-3 text-sm">
                  {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Ready" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-label="Problem" />}
                  <div className="min-w-0"><p className="truncate font-semibold">Row {r.row}: {r.title}</p>{r.errors.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-destructive">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>}</div>
                </li>
              ))}
            </ul>
            <button type="button" disabled={busy || good === 0} onClick={commit} className={btnPrimary}>{busy ? "Importing…" : `Import ${good} ${good === 1 ? "listing" : "listings"} as drafts`}</button>
          </>}
        </div>
      )}

      {done && (
        <div role="status" className="space-y-3 rounded-2xl border border-border p-5">
          <p className="text-lg font-extrabold">{done.created} {done.created === 1 ? "draft" : "drafts"} created{done.failed ? `, ${done.failed} not imported` : ""}.</p>
          {done.results.filter((r) => !r.ok).slice(0, 20).map((r) => <p key={r.row} className="text-sm text-destructive">Row {r.row} ({r.title}): {r.error}</p>)}
          <div className="flex flex-wrap gap-3">
            <Link to="/dashboard/agency/$slug/listings" params={{ slug }} search={{ status: "draft" }} className={btnPrimary}>Open my drafts</Link>
            <button type="button" onClick={() => { setDone(null); setFileName(""); }} className={btnGhost}>Import another file</button>
          </div>
        </div>
      )}
    </section>
  );
}
