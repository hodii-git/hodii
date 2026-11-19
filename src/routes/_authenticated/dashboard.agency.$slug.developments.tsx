import { LoaderBlock } from "@/components/loader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadPhoto } from "@/components/dashboard/upload";
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
        <p className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">No developments yet. Add your first project so buyers can find it under New developments.</p>
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
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const up = <K extends keyof DevelopmentInput>(k: K, v: DevelopmentInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = useMutation({
    mutationFn: (publish: boolean) => saveAgencyDevelopment({ data: { slug, dev: { ...f, publish } } }),
    onSuccess: (_r, publish) => { toast.success(publish ? "Development published" : "Draft saved"); onDone(); },
    onError: (e) => setMsg(errorText(e, "Please check the details and try again.")),
  });
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of [...files].slice(0, DEVELOPMENT_LIMITS.imagesMax - f.images.length)) {
        const u = await uploadPhoto(slug, "listing", file);
        setF((p) => ({ ...p, images: [...p.images, { ...u, alt: u.alt || p.name }] }));
      }
    } catch (e) { toast.error(errorText(e, "A photo could not be uploaded. Please try again.")); } finally { setBusy(false); if (file.current) file.current.value = ""; }
  };
  const setUnit = (i: number, patch: Partial<DevelopmentInput["unitTypes"][number]>) => up("unitTypes", f.unitTypes.map((u, n) => (n === i ? { ...u, ...patch } : u)));
  return (
    <form className="border border-border bg-card shadow-sm grid gap-5 rounded-3xl p-6 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setMsg(null); save.mutate(true); }}>
      <div className="flex items-center justify-between md:col-span-2"><h2 className="text-xl font-extrabold">{f.id ? "Edit development" : "Add a development"}</h2><button type="button" className={`${btnGhost} h-9 px-3`} onClick={onDone}><X className="size-4" aria-hidden />Close</button></div>
      <Field id="d-name" label="Project name"><input id="d-name" className={inputCls} value={f.name} maxLength={DEVELOPMENT_LIMITS.nameMax} onChange={(e) => up("name", e.target.value)} required /></Field>
      <Field id="d-stage" label="Stage"><Pick label="Stage" value={f.status} onChange={(v) => up("status", v as DevelopmentInput["status"])} options={STAGES.map(([k, l]) => ({ value: k, label: l }))} /></Field>
      <Field id="d-county" label="County"><Pick label="County" value={String(f.countyCode)} onChange={(v) => up("countyCode", Number(v) || 47)} options={COUNTY_OPTIONS} searchable /></Field>
      <Field id="d-area" label="Area or neighbourhood"><input id="d-area" className={inputCls} value={f.areaName} onChange={(e) => up("areaName", e.target.value)} required minLength={2} /></Field>
      <Field id="d-done" label="Expected completion" hint="Leave empty if not yet known."><input id="d-done" type="date" className={inputCls} value={f.completionDate ?? ""} onChange={(e) => up("completionDate", e.target.value || null)} /></Field>
      <Field id="d-cur" label="Currency"><Pick label="Currency" value={f.currency} onChange={(v) => up("currency", v as "KES" | "USD")} options={[{ value: "KES", label: "KES" }, { value: "USD", label: "USD" }]} /></Field>
      <Field id="d-from" label="Lowest price"><input id="d-from" inputMode="numeric" className={inputCls} value={f.priceFrom ?? ""} onChange={(e) => up("priceFrom", numOrNull(e.target.value))} /></Field>
      <Field id="d-to" label="Highest price"><input id="d-to" inputMode="numeric" className={inputCls} value={f.priceTo ?? ""} onChange={(e) => up("priceTo", numOrNull(e.target.value))} /></Field>
      <div className="md:col-span-2"><Field id="d-desc" label="About the project" hint={`At least ${DEVELOPMENT_LIMITS.descriptionMin} characters to publish.`}><textarea id="d-desc" rows={6} className={areaCls} maxLength={DEVELOPMENT_LIMITS.descriptionMax} value={f.description} onChange={(e) => up("description", e.target.value)} /></Field></div>

      <div className="md:col-span-2">
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

      <div className="md:col-span-2"><p className="mb-1 text-sm font-bold">Features</p><MultiPick label="Features" allLabel="Choose features" values={f.features} onChange={(v) => up("features", v as DevelopmentInput["features"])} options={FEATURES.map((x) => ({ value: x.key, label: x.label, group: x.group }))} max={30} /></div>

      <div className="md:col-span-2">
        <p className="text-sm font-bold">Photos and renders <span className="font-normal text-muted-foreground">({f.images.length}/{DEVELOPMENT_LIMITS.imagesMax}). The first is the cover.</span></p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {f.images.map((im, i) => (
            <li key={im.url} className="relative">
              <img src={im.thumbUrl ?? im.url} alt={im.alt || ""} className="size-24 rounded-xl object-cover" />
              <button type="button" aria-label="Remove photo" className="absolute -right-1 -top-1 rounded-full bg-background p-1 shadow" onClick={() => up("images", f.images.filter((_, n) => n !== i))}><X className="size-3.5" aria-hidden /></button>
            </li>
          ))}
        </ul>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void addPhotos(e.target.files)} />
        <button type="button" className={`${btnGhost} mt-2`} disabled={busy || f.images.length >= DEVELOPMENT_LIMITS.imagesMax} onClick={() => file.current?.click()}>{busy ? "Uploading…" : "Add photos"}</button>
      </div>
      <Field id="d-brochure" label="Brochure link (https://)"><input id="d-brochure" className={inputCls} value={f.brochureUrl ?? ""} onChange={(e) => up("brochureUrl", e.target.value.trim() || null)} placeholder="https://" /></Field>
      <Field id="d-video" label="Video link (https://)"><input id="d-video" className={inputCls} value={f.videoUrl ?? ""} onChange={(e) => up("videoUrl", e.target.value.trim() || null)} placeholder="https://" /></Field>

      {msg && <p role="alert" className="text-sm text-destructive md:col-span-2">{msg}</p>}
      <div className="flex flex-wrap gap-3 md:col-span-2">
        <button type="submit" className={btnPrimary} disabled={save.isPending || busy}>{save.isPending ? "Saving…" : "Publish"}</button>
        <button type="button" className={btnGhost} disabled={save.isPending || busy} onClick={() => { setMsg(null); save.mutate(false); }}>Save as draft</button>
      </div>
    </form>
  );
}
