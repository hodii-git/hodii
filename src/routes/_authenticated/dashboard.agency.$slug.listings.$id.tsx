import { createFileRoute, getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { Sel } from "@/components/ui/sel";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LocateFixed } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge, Field, areaCls, btnGhost, btnPrimary, errorText, inputCls } from "@/components/dashboard/ui";
import { PhotoManager } from "@/components/dashboard/photo-manager";
import { NearbyEditor, cleanNearby } from "@/components/dashboard/nearby-editor";
import { BASIC, VisibilityStep, type Visibility } from "@/components/dashboard/visibility-step";
import { LimitPanel } from "@/components/dashboard/limit-panel";
import { addListingsToPackage } from "@/lib/payments.functions";
import { can } from "@/lib/access";
import { retry } from "@/lib/retry";
import { getAgencyAgents, getListingForEdit, saveAgencyListing } from "@/lib/dashboard.functions";
import { blankListingForm, type ListingForm } from "@/lib/listing-compose";
import { COUNTY_LIST , COUNTY_LIST_NAIROBI_FIRST } from "@/lib/mongodb/kenya";
import { LISTING_LIMITS } from "@/lib/mongodb/limits";
import { AREA_UNITS, CONDITIONS, CURRENCIES, FEATURE_GROUPS, FURNISHINGS, LAND_ZONINGS, LISTING_TYPES, PAYMENT_PLANS, PROPERTY_CATEGORIES, PROPERTY_TYPES, TITLE_TYPES, UTILITIES, featuresFor, propertyTypeInfo, type ListingType } from "@/lib/mongodb/taxonomy";

const parent = getRouteApi("/_authenticated/dashboard/agency/$slug");
export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/listings/$id")({
  head: () => ({ meta: [{ title: "Listing — Hodii" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ params }) => (params.id === "new" ? null : getListingForEdit({ data: { slug: params.slug, id: params.id } })),
  staleTime: 0,
  component: Editor,
});

const PERIODS: Record<ListingType, readonly ("total" | "month" | "year" | "week" | "night")[]> = { sale: ["total"], rent: ["month", "year"], short_stay: ["night", "week"] };
const PERIOD_LABEL = { total: "Total price", month: "per month", year: "per year", week: "per week", night: "per night" } as const;
const intOrNull = (v: string) => { const n = Number(v.replace(/[, ]/g, "")); return v.trim() === "" || !Number.isFinite(n) ? null : Math.max(0, Math.floor(n)); };
const numOrNull = (v: string) => { const n = Number(v); return v.trim() === "" || !Number.isFinite(n) ? null : Math.max(0, n); };

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return <section aria-labelledby={id} className="glass rounded-3xl p-5 md:p-6"><h2 id={id} className="text-lg font-extrabold">{title}</h2>{hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}<div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div></section>;
}
const Num = ({ id, label, value, onChange, int = true, hint, max }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; int?: boolean; hint?: string; max?: number }) => (
  <Field id={id} label={label} {...(hint ? { hint } : {})}><input id={id} inputMode={int ? "numeric" : "decimal"} defaultValue={value ?? ""} key={value ?? "blank"} onBlur={(e) => { const v = int ? intOrNull(e.target.value) : numOrNull(e.target.value); onChange(v !== null && max !== undefined ? Math.min(v, max) : v); }} className={inputCls} /></Field>
);

const STEPS = ["Basics", "Price and place", "Details", "Photos", "Contact and nearby", "Visibility"] as const;
function StepPane({ n, step, children }: { n: number; step: number; children: ReactNode }) {
  // Kept mounted but hidden, so nothing typed on an earlier step is ever lost.
  return <div hidden={step !== n} className="space-y-6">{children}</div>;
}

function Editor() {
  const { slug, id } = Route.useParams();
  const loaded = Route.useLoaderData();
  const role = parent.useLoaderData().agency.role;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<ListingForm>(() => loaded?.form ?? blankListingForm());
  const [listingId, setListingId] = useState<string | null>(loaded?.id ?? null);
  const [status, setStatus] = useState(loaded?.status ?? "draft");
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [step, setStep] = useState(0);
  const [vis, setVis] = useState<Visibility>(BASIC);
  const [limit, setLimit] = useState<{ kind: "live" | "stored"; used: number; allowance: number; message: string } | null>(null);
  const idRef = useRef<string | null>(loaded?.id ?? null);
  const agents = useQuery({ queryKey: ["agency", slug, "agents"], queryFn: () => getAgencyAgents({ data: { slug } }), staleTime: 60_000 });

  const info = propertyTypeInfo(form.propertyType);
  const category = info?.category ?? "residential";
  const residential = category === "residential", land = category === "land";
  const features = useMemo(() => featuresFor(category), [category]);
  const set = (p: Partial<ListingForm>) => setForm((f) => ({ ...f, ...p }));
  const setDetails = (p: Partial<ListingForm["details"]>) => setForm((f) => ({ ...f, details: { ...f.details, ...p } }));
  const setLoc = (p: Partial<ListingForm["location"]>) => setForm((f) => ({ ...f, location: { ...f.location, ...p } }));
  const err = (prefix: string) => issues.find((i) => i.path === prefix || i.path.startsWith(`${prefix}.`))?.message;

  const changeType = (listingType: ListingType) => setForm((f) => ({
    ...f, listingType,
    price: f.price ? { ...f.price, period: PERIODS[listingType].includes(f.price.period) ? f.price.period : PERIODS[listingType][0]! } : null,
    rental: listingType === "rent" ? f.rental ?? { depositMonths: null, minLeaseMonths: null, serviceChargeKes: null, utilitiesIncluded: [], availableFrom: null } : null,
    shortStay: listingType === "short_stay" ? f.shortStay ?? { maxGuests: 2, minNights: 1, checkInTime: null, checkOutTime: null } : null,
    sale: listingType === "sale" ? f.sale ?? { paymentPlans: [] } : null,
  }));
  const changePropertyType = (propertyType: ListingForm["propertyType"]) => {
    const cat = propertyTypeInfo(propertyType)?.category ?? "residential";
    const allowed = new Set(featuresFor(cat).map((x) => x.key));
    setForm((f) => ({ ...f, propertyType, features: f.features.filter((k) => allowed.has(k)) }));
  };
  const useMyLocation = () => navigator.geolocation?.getCurrentPosition(
    (p) => setLoc({ point: { lat: Math.round(p.coords.latitude * 1e5) / 1e5, lng: Math.round(p.coords.longitude * 1e5) / 1e5 } }),
    () => toast.error("Could not read your location. Enter the coordinates instead, or leave them blank."), { timeout: 8000 });

  const goTo = (n: number) => { setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); };
  /** Continue: from the last details step the draft is saved first, so the visibility step can price this property. */
  const next = async () => {
    if (step === 4 && status !== "published" && status !== "pending_review") { const ok = await save("draft", { stay: true }); if (!ok) return; }
    goTo(Math.min(STEPS.length - 1, step + 1));
  };

  const save = async (intent: "draft" | "publish", opts: { stay?: boolean } = {}): Promise<boolean> => {
    const wasLive = status === "published" || status === "pending_review";
    setBusy(intent); setIssues([]);
    try {
      // Saving an existing listing is safe to repeat, so a dropped connection is retried. A brand-new listing is not, or a lost reply could create it twice.
      const doSave = () => saveAgencyListing({ data: { slug, id: listingId, intent, form: { ...form, nearby: cleanNearby(form.nearby) } } });
      const r = await (listingId && listingId !== "new" ? retry(doSave, { tries: 3, onRetry: () => toast.message("Connection problem, trying again…") }) : doSave());
      if (!r.ok && r.limit) {
        // At the free limit. A boost or Premium choice already made carries on at once; otherwise show the ways forward.
        if (r.limit.kind === "live" && intent === "publish" && vis.plan !== "basic") {
          const saved = await saveAgencyListing({ data: { slug, id: listingId, intent: "draft", form: { ...form, nearby: cleanNearby(form.nearby) } } });
          if (saved.ok) {
            idRef.current = saved.id; setListingId(saved.id); setStatus(saved.status);
            if (vis.plan === "boost" && vis.days) { toast.message("Pay for your boost and the listing goes live."); navigate({ to: "/dashboard/agency/$slug/promote/$id", params: { slug, id: saved.id }, search: { days: vis.days } }); return true; }
            if (vis.plan === "premium" && vis.packageId) {
              const a = await addListingsToPackage({ data: { slug, packageId: vis.packageId, ids: [saved.id] } }).catch(() => null);
              if (a?.added.length) { toast.success("Added to your Premium package. Your listing is live."); navigate({ to: "/dashboard/agency/$slug/listings", params: { slug } }); return true; }
              toast.error(a?.skipped[0]?.reason ?? "Could not add it to the package.");
            }
          }
        }
        setLimit(r.limit);
        window.setTimeout(() => document.getElementById("limit-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
        return false;
      }
      if (!r.ok) {
        setIssues(r.issues);
        toast.error(r.issues[0]?.message ?? "Please check the highlighted fields");
        document.getElementById("issues")?.focus();
        return false;
      }
      await qc.invalidateQueries({ queryKey: ["agency", slug] });
      qc.invalidateQueries({ queryKey: ["property-home"] });
      idRef.current = r.id; setListingId(r.id); setStatus(r.status); setLimit(null);
      if (intent === "publish") {
        toast.success("Your listing is live");
        if (wasLive) { navigate({ to: "/dashboard/agency/$slug/listings", params: { slug } }); return true; }
        // The visibility choice was made on the last step; act on it now that the listing exists.
        if (vis.plan === "boost" && vis.days) navigate({ to: "/dashboard/agency/$slug/promote/$id", params: { slug, id: r.id }, search: { days: vis.days } });
        else if (vis.plan === "premium" && vis.packageId) {
          if (r.status === "published") {
            const a = await addListingsToPackage({ data: { slug, packageId: vis.packageId, ids: [r.id] } }).catch(() => null);
            toast[a?.added.length ? "success" : "error"](a?.added.length ? "Added to your Premium package" : (a?.skipped[0]?.reason ?? "Could not add it to the package. You can do it from Premium."));
          } else toast.message("Add it to your package once it is approved and live.");
          navigate({ to: "/dashboard/agency/$slug/listings", params: { slug } });
        } else navigate({ to: "/dashboard/agency/$slug/listings", params: { slug } });
      } else {
        if (!opts.stay) toast.success("Draft saved");
        if (id === "new") navigate({ to: "/dashboard/agency/$slug/listings/$id", params: { slug, id: r.id }, replace: true });
      }
      return true;
    } catch (e) { toast.error(errorText(e, "Could not save. Check your details and try again.")); return false; }
    finally { setBusy(null); }
  };

  const isLive = status === "published";
  const price = form.price;
  const titleLen = form.title.length, descLen = form.description.length;

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (step === STEPS.length - 1) save("publish"); else next(); }} className="space-y-6" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><h2 className="text-2xl font-extrabold">{listingId ? "Edit listing" : "New listing"}</h2>{listingId && <Badge value={status} />}</div>
        <Link to="/dashboard/agency/$slug/listings" params={{ slug }} className="text-sm font-semibold text-muted-foreground hover:underline">Back to listings</Link>
      </div>
      {loaded?.rejectionReason && <p role="note" className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"><strong>Not approved:</strong> {loaded.rejectionReason}. Fix this and publish again.</p>}
      {limit && (
        <div id="limit-panel"><LimitPanel slug={slug} info={limit} listingId={listingId} days={vis.days ?? 7} onKeep={async (then) => {
          const ok = listingId ? true : await save("draft", { stay: true });
          const id = idRef.current;
          if (!ok && !id) { navigate({ to: "/dashboard/agency/$slug/listings", params: { slug } }); return; }
          if (then === "boost" && id) navigate({ to: "/dashboard/agency/$slug/promote/$id", params: { slug, id }, search: { days: vis.days ?? 7 } });
          else if (then === "premium") navigate({ to: "/dashboard/agency/$slug/premium", params: { slug } });
          else if (then === "space") navigate({ to: "/dashboard/agency/$slug/space", params: { slug } });
          else navigate({ to: "/dashboard/agency/$slug/listings", params: { slug } });
        }} /></div>
      )}
      {issues.length > 0 && (
        <div id="issues" tabIndex={-1} role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-bold">Please fix these before publishing:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{issues.map((i, k) => <li key={k}>{i.message}</li>)}</ul>
        </div>
      )}

      <nav aria-label="Steps" className="flex flex-wrap gap-2">
        {STEPS.map((t, i) => <button key={t} type="button" aria-current={step === i ? "step" : undefined} onClick={() => goTo(i)} className={`rounded-full border px-4 py-1.5 text-sm font-bold ${step === i ? "border-primary bg-primary text-primary-foreground" : i < step ? "border-primary/50" : "border-border text-muted-foreground"}`}>{i + 1}. {t}</button>)}
      </nav>

      <StepPane n={0} step={step}>
      <Section id="s-basics" title="What are you listing?">
        <Field id="lt" label="Listing type"><Sel id="lt" value={form.listingType} onChange={(e) => changeType(e.target.value as ListingType)} className={inputCls}>{LISTING_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Sel></Field>
        <Field id="pt" label="Property type"><Sel id="pt" value={form.propertyType} onChange={(e) => changePropertyType(e.target.value as ListingForm["propertyType"])} className={inputCls}>
          {PROPERTY_CATEGORIES.map((c) => <optgroup key={c.key} label={c.label}>{PROPERTY_TYPES.filter((t) => t.category === c.key).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</optgroup>)}
        </Sel></Field>
        <div className="sm:col-span-2"><Field id="ti" label="Title" hint={`${titleLen}/${LISTING_LIMITS.titleMax}. Say what it is and where, e.g. "3 bedroom apartment with a balcony in Kilimani".`} error={err("title")}><input id="ti" value={form.title} maxLength={LISTING_LIMITS.titleMax} onChange={(e) => set({ title: e.target.value })} className={inputCls} /></Field></div>
        <div className="sm:col-span-2"><Field id="de" label="Description" hint={`${descLen}/${LISTING_LIMITS.descriptionMax}. At least ${LISTING_LIMITS.descriptionMin} characters. Describe the layout, the neighbourhood and what is included.`} error={err("description")}><textarea id="de" rows={7} value={form.description} maxLength={LISTING_LIMITS.descriptionMax} onChange={(e) => set({ description: e.target.value })} className={areaCls} /></Field></div>
        <div className="sm:col-span-2"><Field id="hl" label="Highlights (optional)" hint={`Up to ${LISTING_LIMITS.highlightsMax}, one per line. Shown as ticks at the top of the listing.`}><textarea id="hl" rows={3} defaultValue={form.highlights.join("\n")} onBlur={(e) => set({ highlights: e.target.value.split("\n").map((s) => s.trim().slice(0, LISTING_LIMITS.highlightMax)).filter(Boolean).slice(0, LISTING_LIMITS.highlightsMax) })} className={areaCls} /></Field></div>
      </Section>

      </StepPane>
      <StepPane n={1} step={step}>
      <Section id="s-price" title="Price">
        <Field id="pa" label="Amount" error={err("price")}><input id="pa" inputMode="numeric" defaultValue={price?.amount ?? ""} key={price?.amount ?? "blank"} onBlur={(e) => { const n = intOrNull(e.target.value); set({ price: n === null ? null : { amount: n, currency: price?.currency ?? "KES", period: price?.period ?? PERIODS[form.listingType][0]!, negotiable: price?.negotiable ?? false } }); }} className={inputCls} placeholder="85000" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="cu" label="Currency"><Sel id="cu" value={price?.currency ?? "KES"} onChange={(e) => price && set({ price: { ...price, currency: e.target.value as "KES" | "USD" } })} disabled={!price} className={inputCls}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Sel></Field>
          <Field id="pe" label="Period"><Sel id="pe" value={price?.period ?? PERIODS[form.listingType][0]} onChange={(e) => price && set({ price: { ...price, period: e.target.value as never } })} disabled={!price || PERIODS[form.listingType].length === 1} className={inputCls}>{PERIODS[form.listingType].map((p) => <option key={p} value={p}>{PERIOD_LABEL[p]}</option>)}</Sel></Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={price?.negotiable ?? false} disabled={!price} onChange={(e) => price && set({ price: { ...price, negotiable: e.target.checked } })} className="h-4 w-4" />Price is negotiable</label>
      </Section>

      <Section id="s-loc" title="Location" hint="Choose the county and the area people search for, such as Kilimani, Nyali or Kitengela.">
        <Field id="co" label="County" error={err("location.countyCode")}><Sel id="co" value={form.location.countyCode ?? ""} onChange={(e) => setLoc({ countyCode: e.target.value ? Number(e.target.value) : null })} className={inputCls}><option value="">Choose a county</option>{COUNTY_LIST_NAIROBI_FIRST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Sel></Field>
        <Field id="ar" label="Area or estate" error={err("location.areaName")}><input id="ar" value={form.location.areaName} maxLength={LISTING_LIMITS.areaNameMax} onChange={(e) => setLoc({ areaName: e.target.value })} className={inputCls} /></Field>
        <Field id="ad" label="Street or building (optional)"><input id="ad" value={form.location.address ?? ""} maxLength={LISTING_LIMITS.addressMax} onChange={(e) => setLoc({ address: e.target.value || null })} className={inputCls} /></Field>
        <Field id="lm" label="Nearby landmark (optional)"><input id="lm" value={form.location.landmark ?? ""} maxLength={LISTING_LIMITS.landmarkMax} onChange={(e) => setLoc({ landmark: e.target.value || null })} className={inputCls} placeholder="Near Yaya Centre" /></Field>
        <Field id="la" label="Latitude (optional)"><input id="la" inputMode="decimal" key={form.location.point?.lat ?? "n"} defaultValue={form.location.point?.lat ?? ""} onBlur={(e) => { const lat = numOrNull(e.target.value); setLoc({ point: lat === null || !form.location.point ? (lat === null ? null : { lat, lng: 0 }) : { ...form.location.point, lat } }); }} className={inputCls} placeholder="-1.2921" /></Field>
        <Field id="ln" label="Longitude (optional)" error={err("location.point")}><input id="ln" inputMode="decimal" key={form.location.point?.lng ?? "n"} defaultValue={form.location.point?.lng ?? ""} onBlur={(e) => { const lng = numOrNull(e.target.value); if (lng !== null && form.location.point) setLoc({ point: { ...form.location.point, lng } }); }} className={inputCls} placeholder="36.8219" /></Field>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <button type="button" onClick={useMyLocation} className={`${btnGhost} h-9 px-3`}><LocateFixed className="h-4 w-4" aria-hidden />Use my current location</button>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.location.hideExactLocation} onChange={(e) => setLoc({ hideExactLocation: e.target.checked })} className="h-4 w-4" />Hide the exact address and show only the neighbourhood on the map</label>
        </div>
      </Section>

      </StepPane>
      <StepPane n={2} step={step}>
      <Section id="s-details" title="Details">
        {residential && <>
          <Num id="bd" label="Bedrooms" value={form.details.bedrooms} onChange={(v) => setDetails({ bedrooms: v })} max={LISTING_LIMITS.bedroomsMax} hint="Enter 0 for a studio or bedsitter." />
          <Num id="ba" label="Bathrooms" value={form.details.bathrooms} onChange={(v) => setDetails({ bathrooms: v })} max={LISTING_LIMITS.bathroomsMax} />
          <Num id="en" label="Ensuite bedrooms" value={form.details.ensuiteBedrooms} onChange={(v) => setDetails({ ensuiteBedrooms: v })} max={LISTING_LIMITS.bedroomsMax} />
          <Num id="sq" label="Servant quarters" value={form.details.servantQuarters} onChange={(v) => setDetails({ servantQuarters: v })} max={10} />
        </>}
        {!land && <>
          <Num id="pk" label="Parking spaces" value={form.details.parkingSpaces} onChange={(v) => setDetails({ parkingSpaces: v })} max={LISTING_LIMITS.parkingMax} />
          <Num id="fa" label="Floor area (m²)" value={form.details.floorAreaSqm} int={false} onChange={(v) => setDetails({ floorAreaSqm: v })} max={LISTING_LIMITS.floorAreaMaxSqm} />
          <Num id="fl" label="Floor level" value={form.details.floorLevel} onChange={(v) => setDetails({ floorLevel: v })} hint="0 is the ground floor." />
          <Num id="tf" label="Floors in the building" value={form.details.totalFloors} onChange={(v) => setDetails({ totalFloors: v })} />
          <Num id="yb" label="Year built" value={form.details.yearBuilt} onChange={(v) => setDetails({ yearBuilt: v })} />
          <Field id="cn" label="Condition"><Sel id="cn" value={form.details.condition ?? ""} onChange={(e) => setDetails({ condition: (e.target.value || null) as never })} className={inputCls}><option value="">Not stated</option>{CONDITIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Sel></Field>
          <Field id="fu" label="Furnishing"><Sel id="fu" value={form.details.furnishing ?? ""} onChange={(e) => setDetails({ furnishing: (e.target.value || null) as never })} className={inputCls}><option value="">Not stated</option>{FURNISHINGS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Sel></Field>
        </>}
        {land && <>
          <Num id="ps" label="Plot size" value={form.details.plotAreaValue} int={false} onChange={(v) => setDetails({ plotAreaValue: v, plotAreaUnit: form.details.plotAreaUnit ?? "acre" })} />
          <Field id="pu" label="Unit"><Sel id="pu" value={form.details.plotAreaUnit ?? "acre"} onChange={(e) => setDetails({ plotAreaUnit: e.target.value as never })} className={inputCls}>{AREA_UNITS.map((u) => <option key={u} value={u}>{u === "sqm" ? "square metres" : u === "sqft" ? "square feet" : u === "acre" ? "acres" : "hectares"}</option>)}</Sel></Field>
          <Field id="zo" label="Zoning"><Sel id="zo" value={form.details.zoning ?? ""} onChange={(e) => setDetails({ zoning: (e.target.value || null) as never })} className={inputCls}><option value="">Not stated</option>{LAND_ZONINGS.map((z) => <option key={z} value={z}>{z.replace("_", " ").replace(/^./, (c) => c.toUpperCase())}</option>)}</Sel></Field>
        </>}
        <Field id="tt" label="Title type"><Sel id="tt" value={form.legal.titleType ?? ""} onChange={(e) => set({ legal: { ...form.legal, titleType: (e.target.value || null) as never } })} className={inputCls}><option value="">Not stated</option>{TITLE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Sel></Field>
        {form.legal.titleType === "leasehold" && <Num id="ly" label="Years left on the lease" value={form.legal.leaseYearsRemaining} onChange={(v) => set({ legal: { ...form.legal, leaseYearsRemaining: v } })} />}
        {form.listingType === "sale" && <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold"><input type="checkbox" checked={form.legal.titleDeedReady ?? false} onChange={(e) => set({ legal: { ...form.legal, titleDeedReady: e.target.checked } })} className="h-4 w-4" />Title deed is ready</label>}
      </Section>

      {form.rental && <Section id="s-rent" title="Rental terms">
        <Num id="dp" label="Deposit (months of rent)" value={form.rental.depositMonths} onChange={(v) => set({ rental: { ...form.rental!, depositMonths: v } })} max={12} />
        <Num id="ml" label="Minimum lease (months)" value={form.rental.minLeaseMonths} onChange={(v) => set({ rental: { ...form.rental!, minLeaseMonths: v } })} />
        <Num id="sc" label="Service charge (KES per month)" value={form.rental.serviceChargeKes} onChange={(v) => set({ rental: { ...form.rental!, serviceChargeKes: v } })} />
        <Field id="av" label="Available from"><input id="av" type="date" defaultValue={form.rental.availableFrom?.slice(0, 10) ?? ""} onChange={(e) => set({ rental: { ...form.rental!, availableFrom: e.target.value ? new Date(`${e.target.value}T00:00:00+03:00`).toISOString() : null } })} className={inputCls} /></Field>
        <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-semibold">Included in the rent</legend><div className="flex flex-wrap gap-2">{UTILITIES.map((u) => { const on = form.rental!.utilitiesIncluded.includes(u.key); return <button key={u.key} type="button" aria-pressed={on} onClick={() => set({ rental: { ...form.rental!, utilitiesIncluded: on ? form.rental!.utilitiesIncluded.filter((k) => k !== u.key) : [...form.rental!.utilitiesIncluded, u.key] } })} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>{u.label}</button>; })}</div></fieldset>
      </Section>}
      {form.shortStay && <Section id="s-stay" title="Stay details">
        <Num id="mg" label="Maximum guests" value={form.shortStay.maxGuests} onChange={(v) => set({ shortStay: { ...form.shortStay!, maxGuests: Math.max(1, v ?? 1) } })} max={LISTING_LIMITS.maxGuests} />
        <Num id="mn" label="Minimum nights" value={form.shortStay.minNights} onChange={(v) => set({ shortStay: { ...form.shortStay!, minNights: Math.max(1, v ?? 1) } })} max={365} />
        <Field id="ci" label="Check-in time"><input id="ci" type="time" value={form.shortStay.checkInTime ?? ""} onChange={(e) => set({ shortStay: { ...form.shortStay!, checkInTime: e.target.value || null } })} className={inputCls} /></Field>
        <Field id="co2" label="Check-out time"><input id="co2" type="time" value={form.shortStay.checkOutTime ?? ""} onChange={(e) => set({ shortStay: { ...form.shortStay!, checkOutTime: e.target.value || null } })} className={inputCls} /></Field>
      </Section>}
      {form.sale && !land && <Section id="s-pay" title="Payment options (optional)"><fieldset className="sm:col-span-2"><legend className="sr-only">Payment options</legend><div className="flex flex-wrap gap-2">{PAYMENT_PLANS.map((p) => { const on = form.sale!.paymentPlans.includes(p); return <button key={p} type="button" aria-pressed={on} onClick={() => set({ sale: { paymentPlans: on ? form.sale!.paymentPlans.filter((k) => k !== p) : [...form.sale!.paymentPlans, p] } })} className={`rounded-full border px-3 py-1.5 text-sm capitalize ${on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>{p}</button>; })}</div></fieldset></Section>}

      <section aria-labelledby="s-feat" className="glass rounded-3xl p-5 md:p-6">
        <h2 id="s-feat" className="text-lg font-extrabold">Features</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tick what applies, up to {LISTING_LIMITS.featuresMax}. People filter by these.</p>
        <div className="mt-5 space-y-5">
          {FEATURE_GROUPS.map((g) => { const items = features.filter((f) => f.group === g.key); if (!items.length) return null; return (
            <fieldset key={g.key}><legend className="mb-2 text-sm font-bold text-muted-foreground">{g.label}</legend><div className="flex flex-wrap gap-2">
              {items.map((f) => { const on = form.features.includes(f.key); return <button key={f.key} type="button" aria-pressed={on} disabled={!on && form.features.length >= LISTING_LIMITS.featuresMax} onClick={() => set({ features: on ? form.features.filter((k) => k !== f.key) : [...form.features, f.key] })} className={`rounded-full border px-3 py-1.5 text-sm disabled:opacity-40 ${on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>{f.label}</button>; })}
            </div></fieldset>); })}
          <Field id="cf" label="Anything else? (optional)" hint={`Up to ${LISTING_LIMITS.customFeaturesMax}, one per line.`}><textarea id="cf" rows={3} defaultValue={form.customFeatures.join("\n")} onBlur={(e) => set({ customFeatures: e.target.value.split("\n").map((s) => s.trim().slice(0, LISTING_LIMITS.customFeatureMax)).filter(Boolean).slice(0, LISTING_LIMITS.customFeaturesMax) })} className={areaCls} /></Field>
        </div>
      </section>

      </StepPane>
      <StepPane n={3} step={step}>
      <section aria-labelledby="s-photos" className="glass rounded-3xl p-5 md:p-6">
        <h2 id="s-photos" className="text-lg font-extrabold">Photos</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">JPG, PNG or WebP, at least {LISTING_LIMITS.imageMinWidth}×{LISTING_LIMITS.imageMinHeight} pixels. Listings with good photos get far more enquiries.</p>
        {err("images") && <p role="alert" className="mb-3 text-sm font-semibold text-destructive">{err("images")}</p>}
        <PhotoManager slug={slug} images={form.images} onChange={(images) => set({ images })} />
        <details className="mt-6"><summary className="cursor-pointer text-sm font-bold">Floor plans (optional)</summary><div className="mt-3"><PhotoManager slug={slug} images={form.floorPlans} onChange={(floorPlans) => set({ floorPlans })} max={LISTING_LIMITS.floorPlansMax} /></div></details>
      </section>

      </StepPane>
      <StepPane n={4} step={step}>
      <Section id="s-near" title="What is nearby" hint="Optional, but listings with real names and distances are trusted more. Type the exact place and how far it is, under each heading."><NearbyEditor value={form.nearby} onChange={(nearby) => set({ nearby })} /></Section>
      <Section id="s-extra" title="Contact and extras">
        {can(role, "listing.assign") || (agents.data?.length ?? 0) > 1 ? (
          <Field id="ag" label="Contact agent" hint="Enquiries go to this person."><Sel id="ag" value={form.agentId ?? ""} onChange={(e) => set({ agentId: e.target.value || null })} className={inputCls}><option value="">The agency</option>{agents.data?.map((a) => <option key={a.userId} value={a.userId}>{a.name}</option>)}</Sel></Field>
        ) : null}
        <Field id="cp" label="Phone for this listing (optional)" hint="Leave blank to use the agent's or agency's number."><input id="cp" type="tel" value={form.contactPhone ?? ""} onChange={(e) => set({ contactPhone: e.target.value || null })} className={inputCls} placeholder="0712 345 678" /></Field>
        <Field id="vu" label="Video link (optional)" hint="A YouTube or Vimeo link starting with https://"><input id="vu" type="url" value={form.videoUrl ?? ""} onChange={(e) => set({ videoUrl: e.target.value || null })} className={inputCls} /></Field>
        <Field id="vt" label="Virtual tour link (optional)"><input id="vt" type="url" value={form.virtualTourUrl ?? ""} onChange={(e) => set({ virtualTourUrl: e.target.value || null })} className={inputCls} /></Field>
        <Field id="er" label="Your own reference (optional)" hint="Your stock number. Only you see it."><input id="er" value={form.externalRef ?? ""} maxLength={LISTING_LIMITS.externalRefMax} onChange={(e) => set({ externalRef: e.target.value || null })} className={inputCls} /></Field>
      </Section>

      </StepPane>
      <StepPane n={5} step={step}>
        <Section id="s-vis" title={isLive ? "Visibility" : "Before you publish"} hint="Choose how visible the listing should be. You can change this later.">
          <div className="sm:col-span-2"><VisibilityStep slug={slug} listingId={listingId} value={vis} onChange={setVis} live={isLive} /></div>
        </Section>
      </StepPane>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/90 px-4 py-4 backdrop-blur">
        <button type="button" onClick={() => goTo(step - 1)} disabled={step === 0} className={btnGhost}>Back</button>
        <div className="flex flex-wrap items-center gap-3">
          {!isLive && <button type="button" disabled={busy !== null} onClick={() => save("draft")} className={btnGhost}>{busy === "draft" ? "Saving…" : "Save draft"}</button>}
          {step < STEPS.length - 1
            ? <button type="button" disabled={busy !== null} onClick={next} className={btnPrimary}>{busy === "draft" ? "Saving…" : "Continue"}</button>
            : <button disabled={busy !== null || !can(role, "listing.create")} className={btnPrimary}>{busy === "publish" ? "Saving…" : isLive ? "Save changes" : vis.plan === "boost" ? "Publish and pay" : "Publish"}</button>}
        </div>
      </div>
    </form>
  );
}
