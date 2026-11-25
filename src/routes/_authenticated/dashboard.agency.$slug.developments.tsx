import { Loader } from "@/components/loader";
import { LoaderBlock } from "@/components/loader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Building2, FileText, Image as ImageIcon, Link2, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PhotoManager } from "@/components/dashboard/photo-manager";
import { Badge, Field, areaCls, btnGhost, btnPrimary, errorText, inputCls, PageHeader } from "@/components/dashboard/ui";
import { Pick } from "@/components/ui/pick";
import { MultiPick } from "@/components/ui/multi-pick";
import { COUNTY_OPTIONS, toOptions } from "@/lib/pick-options";
import { deleteAgencyDevelopment, getAgencyDevelopments, getDevelopmentForEdit, saveAgencyDevelopment } from "@/lib/developments.functions";
import { DEVELOPMENT_LIMITS } from "@/lib/mongodb/limits";
import { FEATURES, PROPERTY_TYPES } from "@/lib/mongodb/taxonomy";
import type { DevelopmentInput } from "@/lib/developments.server";

const listQuery = (slug: string) => queryOptions({ queryKey: ["agency", slug, "developments"], queryFn: () => getAgencyDevelopments({ data: { slug } }) });
export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/developments")({ component: Developments });

const STAGES = [["planning", "Planning"], ["off_plan", "Off-plan"], ["under_construction", "Under construction"], ["completed", "Completed"]] as const;
const blank = (): DevelopmentInput => ({ id: null, name: "", description: "", status: "off_plan", countyCode: 47, areaName: "", point: null, completionDate: null, currency: "KES", priceFrom: null, priceTo: null, unitTypes: [], features: [], images: [], brochureUrl: null, videoUrl: null, publish: false });
const numOrNull = (v: string) => { const n = Number(v.replace(/,/g, "")); return v.trim() && Number.isFinite(n) && n > 0 ? Math.floor(n) : null; };

function Developments() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const { data, isPending, isError, error } = useQuery(listQuery(slug));
  const [editing, setEditing] = useState<DevelopmentInput | null>(null);
  const open = useMutation({ mutationFn: (id: string) => getDevelopmentForEdit({ data: { slug, id } }), onSuccess: (d) => setEditing(d), onError: (e) => toast.error(errorText(e)) });
  const del = useMutation({
    mutationFn: (id: string) => deleteAgencyDevelopment({ data: { slug, id } }),
    onSuccess: () => { toast.success("Development deleted"); void qc.invalidateQueries({ queryKey: ["agency", slug, "developments"] }); }, onError: (e) => toast.error(errorText(e)),
  });
  if (editing) return <DevForm slug={slug} start={editing} onDone={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ["agency", slug, "developments"] }); }} />;
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Developments" sub="Projects you are selling in units: off-plan, under construction or finished." right={<button className={btnPrimary} onClick={() => setEditing(blank())}><Plus className="size-4" aria-hidden />Add a development</button>} />
      </div>
      {isPending ? <LoaderBlock className="py-10" /> : isError ? <p role="alert" className="mt-6 text-sm text-destructive">{errorText(error)}</p> : data.length === 0 ? (
        <div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">No developments yet. Add your first project so buyers can find it under New developments.</p></div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {data.map((d) => (
            <li key={d.id} className="border border-border bg-card shadow-sm flex flex-wrap items-center gap-3 rounded-2xl p-4">
              <div className="min-w-0 flex-1"><p className="truncate font-extrabold">{d.name}</p><p className="truncate text-sm text-muted-foreground">{d.areaName}{d.county ? `, ${d.county}` : ""} · {d.views} views</p></div>
              <Badge value={d.publishStatus} />
              {d.publishStatus === "published" && <Link to="/development/$slug" params={{ slug: d.slug }} className="text-sm font-bold text-primary hover:underline">View</Link>}
              <button className={`${btnGhost} h-9 px-3`} onClick={() => open.mutate(d.id)} disabled={open.isPending}>Edit</button>
              <button className={`${btnGhost} h-9 px-3`} aria-label={`Delete ${d.name}`} onClick={() => { if (window.confirm(`Delete "${d.name}"? This cannot be undone.`)) del.mutate(d.id); }}><Trash2 className="size-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DevForm({ slug, start, onDone }: { slug: string; start: DevelopmentInput; onDone: () => void }) {
  const [f, setF] = useState(start);
  const [msg, setMsg] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const busy = false;
  const up = <K extends keyof DevelopmentInput>(k: K, v: DevelopmentInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = useMutation({
    mutationFn: (publish: boolean) => saveAgencyDevelopment({ data: { slug, dev: { ...f, publish } } }),
    onSuccess: (_r, publish) => { toast.success(publish ? "Development published" : "Draft saved"); onDone(); },
    onError: (e) => setMsg(errorText(e, "Please check the details and try again.")),
  });
  const setUnit = (i: number, patch: Partial<DevelopmentInput["unitTypes"][number]>) => up("unitTypes", f.unitTypes.map((u, n) => (n === i ? { ...u, ...patch } : u)));
  const stepsList = ["Basics", "Price and place", "Units and features", "Photos", "Links"] as const;
  const last = stepsList.length - 1;
  const Sec = ({ id, title, hint, icon, tone, children }: { id: string; title: string; hint?: string; icon: ReactNode; tone: string; children: ReactNode }) => (
    <section aria-labelledby={id} className="border border-border bg-card shadow-sm rounded-2xl p-5 md:p-6"><div className="flex items-center gap-3"><span aria-hidden className={`grid size-9 place-items-center rounded-xl [&>svg]:size-[18px] ${tone}`}>{icon}</span><h2 id={id} className="text-lg font-extrabold">{title}</h2></div>{hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}<div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div></section>
  );
  const Pane = ({ n, children }: { n: number; children: ReactNode }) => <div hidden={step !== n} className="space-y-6">{children}</div>;
  return (
    <form className="space-y-6" noValidate onSubmit={(e) => { e.preventDefault(); setMsg(null); if (step === last) save.mutate(true); else setStep(step + 1); }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold md:text-3xl">{f.id ? "Edit development" : "New development"}</h1>
        <button type="button" className="text-sm font-semibold text-muted-foreground hover:underline" onClick={onDone}>Back to developments</button>
      </div>
      <nav aria-label="Steps" className="flex flex-wrap gap-2">
        {stepsList.map((t, i) => <button key={t} type="button" aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)} className={`rounded-full border px-4 py-1.5 text-sm font-bold ${step === i ? "border-primary bg-primary text-primary-foreground" : i < step ? "border-primary/50" : "border-border text-muted-foreground"}`}>{i + 1}. {t}</button>)}
      </nav>
      <Pane n={0}><Sec id="d-s-basics" title="About the project" icon={<FileText />} tone="bg-primary/10 text-primary">
      <Field id="d-name" label="Project name"><input id="d-name" className={inputCls} value={f.name} maxLength={DEVELOPMENT_LIMITS.nameMax} onChange={(e) => up("name", e.target.value)} required /></Field>
      <Field id="d-stage" label="Stage"><Pick label="Stage" value={f.status} onChange={(v) => up("status", v as DevelopmentInput["status"])} options={STAGES.map(([k, l]) => ({ value: k, label: l }))} /></Field>
      <div className="sm:col-span-2"><Field id="d-desc" label="About the project" hint={`At least ${DEVELOPMENT_LIMITS.descriptionMin} characters to publish.`}><textarea id="d-desc" rows={6} className={areaCls} maxLength={DEVELOPMENT_LIMITS.descriptionMax} value={f.description} onChange={(e) => up("description", e.target.value)} /></Field></div>
      </Sec></Pane>
      <Pane n={1}><Sec id="d-s-place" title="Price and place" icon={<MapPin />} tone="bg-rose-500/15 text-rose-600">
      <Field id="d-county" label="County"><Pick label="County" value={String(f.countyCode)} onChange={(v) => up("countyCode", Number(v) || 47)} options={COUNTY_OPTIONS} searchable /></Field>
      <Field id="d-area" label="Area or neighbourhood"><input id="d-area" className={inputCls} value={f.areaName} onChange={(e) => up("areaName", e.target.value)} required minLength={2} /></Field>
      <Field id="d-done" label="Expected completion" hint="Leave empty if not yet known."><input id="d-done" type="date" className={inputCls} value={f.completionDate ?? ""} onChange={(e) => up("completionDate", e.target.value || null)} /></Field>
      <Field id="d-cur" label="Currency"><Pick label="Currency" value={f.currency} onChange={(v) => up("currency", v as "KES" | "USD")} options={[{ value: "KES", label: "KES" }, { value: "USD", label: "USD" }]} /></Field>
      <Field id="d-from" label="Lowest price"><input id="d-from" inputMode="numeric" className={inputCls} value={f.priceFrom ?? ""} onChange={(e) => up("priceFrom", numOrNull(e.target.value))} /></Field>
      <Field id="d-to" label="Highest price"><input id="d-to" inputMode="numeric" className={inputCls} value={f.priceTo ?? ""} onChange={(e) => up("priceTo", numOrNull(e.target.value))} /></Field>
      </Sec></Pane>
      <Pane n={2}><Sec id="d-s-units" title="Unit types and features" icon={<Building2 />} tone="bg-violet-500/15 text-violet-600">
      <div className="sm:col-span-2">
        <div className="flex items-center justify-between"><p className="text-sm font-bold">Unit types</p>
          <button type="button" className={`${btnGhost} h-9 px-3`} disabled={f.unitTypes.length >= DEVELOPMENT_LIMITS.unitTypesMax} onClick={() => up("unitTypes", [...f.unitTypes, { label: "", propertyType: "apartment", bedrooms: null, priceFrom: null, unitsAvailable: null }])}><Plus className="size-4" aria-hidden />Add a unit type</button></div>
        <div className="mt-3 grid gap-3">
          {f.unitTypes.map((u, i) => (
            <div key={i} className="grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.2fr_.7fr_1fr_.8fr_auto]">
              <input aria-label="Unit name" placeholder="e.g. 2 bedroom" className={inputCls} value={u.label} onChange={(e) => setUnit(i, { label: e.target.value })} />
              <Pick label="Property type" value={u.propertyType} onChange={(v) => setUnit(i, { propertyType: v as typeof u.propertyType })} options={toOptions(PROPERTY_TYPES)} searchable />
              <input aria-label="Bedrooms" placeholder="Beds" inputMode="numeric" className={inputCls} value={u.bedrooms ?? ""} onChange={(e) => setUnit(i, { bedrooms: e.target.value === "" ? null : Math.min(20, Math.max(0, Math.floor(Number(e.target.value)) || 0)) })} />
              <input aria-label="Price from" placeholder="Price from" inputMode="numeric" className={inputCls} value={u.priceFrom ?? ""} onChange={(e) => setUnit(i, { priceFrom: numOrNull(e.target.value) })} />
              <input aria-label="Units available" placeholder="Available" inputMode="numeric" className={inputCls} value={u.unitsAvailable ?? ""} onChange={(e) => setUnit(i, { unitsAvailable: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value)) || 0) })} />
              <button type="button" className={`${btnGhost} px-3`} aria-label="Remove unit type" onClick={() => up("unitTypes", f.unitTypes.filter((_, n) => n !== i))}><Trash2 className="size-4" aria-hidden /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="sm:col-span-2"><p className="mb-1 text-sm font-bold">Features</p><MultiPick label="Features" allLabel="Choose features" values={f.features} onChange={(v) => up("features", v as DevelopmentInput["features"])} options={FEATURES.map((x) => ({ value: x.key, label: x.label, group: x.group }))} max={30} /></div>
      </Sec></Pane>
      <Pane n={3}><Sec id="d-s-photos" title="Photos and renders" hint={`The first photo is the cover. Up to ${DEVELOPMENT_LIMITS.imagesMax}.`} icon={<ImageIcon />} tone="bg-amber-500/15 text-amber-600">
        <div className="sm:col-span-2"><PhotoManager slug={slug} images={f.images} onChange={(images) => up("images", images)} max={DEVELOPMENT_LIMITS.imagesMax} /></div>
      </Sec></Pane>
      <Pane n={4}><Sec id="d-s-links" title="Brochure and video" icon={<Link2 />} tone="bg-sky-500/15 text-sky-600">
      <Field id="d-brochure" label="Brochure link (https://)"><input id="d-brochure" className={inputCls} value={f.brochureUrl ?? ""} onChange={(e) => up("brochureUrl", e.target.value.trim() || null)} placeholder="https://" /></Field>
      <Field id="d-video" label="Video link (https://)"><input id="d-video" className={inputCls} value={f.videoUrl ?? ""} onChange={(e) => up("videoUrl", e.target.value.trim() || null)} placeholder="https://" /></Field>

      </Sec></Pane>
      {msg && <p role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{msg}</p>}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/90 px-4 py-4 backdrop-blur">
        <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className={btnGhost}>Back</button>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btnGhost} disabled={save.isPending} onClick={() => { setMsg(null); save.mutate(false); }}>Save draft</button>
          {step < last ? <button type="button" className={btnPrimary} onClick={() => setStep(step + 1)}>Continue</button> : <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? <Loader size="xs" label="Saving" /> : "Publish"}</button>}
        </div>
      </div>
    </form>
  );
}
