import { createFileRoute } from "@tanstack/react-router";
import { Sel } from "@/components/ui/sel";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadPhoto } from "@/components/dashboard/upload";
import { Badge, Field, areaCls, btnGhost, btnPrimary, errorText, inputCls } from "@/components/dashboard/ui";
import { getAgencyProfile, requestVerification, saveAgencyProfile } from "@/lib/dashboard.functions";
import { COUNTY_LIST , COUNTY_LIST_NAIROBI_FIRST } from "@/lib/mongodb/kenya";
import { AGENCY_LIMITS } from "@/lib/mongodb/limits";

const profileQuery = (slug: string) => queryOptions({ queryKey: ["agency", slug, "profile"], queryFn: () => getAgencyProfile({ data: { slug } }) });
export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/settings")({ component: Settings });

function Settings() {
  const { slug } = Route.useParams();
  const { data, isPending, isError, error } = useQuery(profileQuery(slug));
  if (isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError) return <p role="alert" className="text-sm text-destructive">{errorText(error, "Could not load the agency.")}</p>;
  return <ProfileForm slug={slug} p={data} />;
}

type Profile = Awaited<ReturnType<typeof getAgencyProfile>>;
function ProfileForm({ slug, p }: { slug: string; p: Profile }) {
  const qc = useQueryClient();
  const [logo, setLogo] = useState<string | null>(p.logoUrl);
  const [areas, setAreas] = useState<number[]>(p.serviceAreas);
  const [msg, setMsg] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(p.coverUrl);
  const coverFile = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const readonly = !p.canEdit;

  const save = useMutation({
    mutationFn: (f: FormData) => {
      const v = (k: string) => String(f.get(k) ?? "").trim();
      return saveAgencyProfile({ data: { slug, name: v("name"), description: v("description"), phone: v("phone"), whatsapp: v("whatsapp") || null, email: v("email"), website: v("website") || null, countyCode: v("county") ? Number(v("county")) : null, area: v("area") || null, serviceAreas: areas, earbNumber: v("earb") || null, businessRegNumber: v("reg") || null, logoUrl: logo, coverUrl: cover,
        tagline: v("tagline"), story: v("story"), services: v("services").split(",").map((x) => x.trim()).filter(Boolean).slice(0, AGENCY_LIMITS.servicesMax), hours: v("hours") || null, foundedYear: v("founded") ? Number(v("founded")) : null,
        socials: { facebook: v("s-facebook") || null, instagram: v("s-instagram") || null, x: v("s-x") || null, tiktok: v("s-tiktok") || null, linkedin: v("s-linkedin") || null, youtube: v("s-youtube") || null } } });
    },
    onSuccess: () => { setMsg(null); toast.success("Agency saved"); qc.invalidateQueries({ queryKey: ["agency", slug] }); },
    onError: (e) => setMsg(errorText(e, "Please check the highlighted details: a Kenyan phone number, a valid email and links starting with https://")),
  });
  const verify = useMutation({
    mutationFn: () => requestVerification({ data: { slug } }),
    onSuccess: () => { toast.success("Sent for verification"); qc.invalidateQueries({ queryKey: ["agency", slug] }); },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <form className="glass grid gap-5 rounded-3xl p-6 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }}>
        <div className="sm:col-span-2">
          <div className="relative h-36 overflow-hidden rounded-2xl bg-muted sm:h-44">
            {cover ? <img src={cover} alt="Cover photo" className="h-full w-full object-cover" /> : <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No cover photo yet</p>}
          </div>
          {!readonly && <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={uploading} onClick={() => coverFile.current?.click()} className={`${btnGhost} h-9 px-3`}>{uploading ? "Uploading…" : cover ? "Change cover photo" : "Upload cover photo"}</button>
            {cover && <button type="button" onClick={() => setCover(null)} className={`${btnGhost} h-9 px-3`}>Remove</button>}
            <input ref={coverFile} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Choose a cover photo" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return; setUploading(true);
              try { setCover((await uploadPhoto(slug, "cover", f)).url); } catch (er) { toast.error(errorText(er, "Could not upload the cover photo")); } finally { setUploading(false); e.target.value = ""; }
            }} />
          </div>}
        </div>
        <div className="flex items-center gap-4 sm:col-span-2">
          {logo ? <img src={logo} alt="Agency logo" width={80} height={80} className="h-20 w-20 rounded-2xl bg-white object-contain p-1" /> : <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-3xl font-extrabold">{p.name[0]}</div>}
          {!readonly && <div className="flex flex-wrap gap-2">
            <button type="button" disabled={uploading} onClick={() => file.current?.click()} className={`${btnGhost} h-9 px-3`}>{uploading ? "Uploading…" : logo ? "Change logo" : "Upload logo"}</button>
            {logo && <button type="button" onClick={() => setLogo(null)} className={`${btnGhost} h-9 px-3`}>Remove</button>}
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Choose a logo" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return; setUploading(true);
              try { setLogo((await uploadPhoto(slug, "logo", f)).url); } catch (er) { toast.error(errorText(er, "Could not upload the logo")); } finally { setUploading(false); e.target.value = ""; }
            }} />
          </div>}
        </div>
        <div className="sm:col-span-2"><Field id="a-name" label="Agency name" hint="Changing the name of a verified agency sends it for re-verification."><input id="a-name" name="name" defaultValue={p.name} required minLength={AGENCY_LIMITS.nameMin} maxLength={AGENCY_LIMITS.nameMax} disabled={readonly} className={inputCls} /></Field></div>
        <div className="sm:col-span-2"><Field id="a-desc" label="About" hint={`Shown on your public page. Up to ${AGENCY_LIMITS.descriptionMax} characters.`}><textarea id="a-desc" name="description" rows={5} defaultValue={p.description} maxLength={AGENCY_LIMITS.descriptionMax} disabled={readonly} className={areaCls} /></Field></div>
        <div className="sm:col-span-2"><Field id="a-tag" label="Tagline" hint="One line under your name, like “Family homes in Nairobi’s eastlands”."><input id="a-tag" name="tagline" defaultValue={p.tagline} maxLength={AGENCY_LIMITS.taglineMax} disabled={readonly} className={inputCls} /></Field></div>
        <div className="sm:col-span-2"><Field id="a-story" label="Your story" hint={`Who you are, how you started, what clients can expect. Blank lines make paragraphs. Up to ${AGENCY_LIMITS.storyMax} characters.`}><textarea id="a-story" name="story" rows={8} defaultValue={p.story} maxLength={AGENCY_LIMITS.storyMax} disabled={readonly} className={areaCls} /></Field></div>
        <div className="sm:col-span-2"><Field id="a-serv" label="Services" hint="Separate with commas, like Sales, Lettings, Property management, Valuation."><input id="a-serv" name="services" defaultValue={p.services.join(", ")} disabled={readonly} className={inputCls} /></Field></div>
        <Field id="a-hours" label="Opening hours (optional)"><input id="a-hours" name="hours" defaultValue={p.hours} maxLength={200} placeholder="Mon–Fri 8am–5pm, Sat 9am–1pm" disabled={readonly} className={inputCls} /></Field>
        <Field id="a-found" label="Year started (optional)"><input id="a-found" name="founded" type="number" min={1900} max={new Date().getFullYear()} defaultValue={p.foundedYear ?? ""} disabled={readonly} className={inputCls} /></Field>
        {(["facebook", "instagram", "x", "tiktok", "linkedin", "youtube"] as const).map((k) => <Field key={k} id={`a-s-${k}`} label={`${k[0]!.toUpperCase()}${k.slice(1)} link (optional)`}><input id={`a-s-${k}`} name={`s-${k}`} type="url" defaultValue={(p.socials as Record<string, string | null | undefined>)[k] ?? ""} placeholder="https://" disabled={readonly} className={inputCls} /></Field>)}
        <Field id="a-phone" label="Phone"><input id="a-phone" name="phone" type="tel" defaultValue={p.phone} required disabled={readonly} className={inputCls} /></Field>
        <Field id="a-wa" label="WhatsApp (optional)"><input id="a-wa" name="whatsapp" type="tel" defaultValue={p.whatsapp ?? ""} disabled={readonly} className={inputCls} /></Field>
        <Field id="a-email" label="Email"><input id="a-email" name="email" type="email" defaultValue={p.email} required disabled={readonly} className={inputCls} /></Field>
        <Field id="a-web" label="Website (optional)"><input id="a-web" name="website" type="url" defaultValue={p.website ?? ""} placeholder="https://" disabled={readonly} className={inputCls} /></Field>
        <Field id="a-county" label="County"><Sel id="a-county" name="county" defaultValue={p.countyCode ?? ""} disabled={readonly} className={inputCls}><option value="">Choose a county</option>{COUNTY_LIST_NAIROBI_FIRST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Sel></Field>
        <Field id="a-area" label="Office area (optional)"><input id="a-area" name="area" defaultValue={p.area ?? ""} disabled={readonly} className={inputCls} placeholder="Westlands, Nairobi" /></Field>
        <fieldset className="sm:col-span-2" disabled={readonly}>
          <legend className="mb-2 text-sm font-semibold">Counties you cover</legend>
          <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
            {COUNTY_LIST_NAIROBI_FIRST.map((c) => { const on = areas.includes(c.code); return <button key={c.code} type="button" aria-pressed={on} onClick={() => setAreas((a) => (on ? a.filter((x) => x !== c.code) : a.length < AGENCY_LIMITS.serviceAreasMax ? [...a, c.code] : a))} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>{c.name}</button>; })}
          </div>
        </fieldset>
        <Field id="a-reg" label="Business registration number" hint="From your certificate of incorporation or business name registration."><input id="a-reg" name="reg" defaultValue={p.businessRegNumber ?? ""} maxLength={AGENCY_LIMITS.registrationNumberMax} disabled={readonly} className={inputCls} /></Field>
        <Field id="a-earb" label="EARB number (optional)" hint="Estate Agents Registration Board licence."><input id="a-earb" name="earb" defaultValue={p.earbNumber ?? ""} maxLength={AGENCY_LIMITS.registrationNumberMax} disabled={readonly} className={inputCls} /></Field>
        {msg && <p role="alert" className="text-sm font-semibold text-destructive sm:col-span-2">{msg}</p>}
        {!readonly && <div className="sm:col-span-2"><button disabled={save.isPending || uploading} className={btnPrimary}>{save.isPending ? "Saving…" : "Save agency"}</button></div>}
      </form>

      <aside className="glass h-fit space-y-3 rounded-3xl p-5" aria-labelledby="ver">
        <h2 id="ver" className="text-lg font-extrabold">Verification</h2>
        <Badge value={p.verification.status === "verified" ? "verified" : p.verification.status === "pending" ? "pending" : "unverified"} />
        {p.verification.status === "verified" && <p className="text-sm text-muted-foreground">You are verified. Your listings go live straight away and show the verified badge.</p>}
        {p.verification.status === "pending" && <p className="flex items-start gap-2 text-sm text-muted-foreground"><span aria-hidden className="mt-1 inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />Verification in progress. Our team is checking your details. Keep listing as normal: your listings go live straight away, and the verified badge appears once you are approved.</p>}
        {p.verification.status === "rejected" && <p role="note" className="text-sm text-destructive">Not approved{p.verification.rejectionReason ? `: ${p.verification.rejectionReason}` : "."} Update your details and submit again.</p>}
        {(p.verification.status === "unverified" || p.verification.status === "rejected") && <>
          <p className="text-sm text-muted-foreground">Save your registration number, then submit. You can list without waiting. Verified agencies get a verified badge on their agency page and listings.</p>
          {p.canSubmitVerification && <button className={btnPrimary} disabled={verify.isPending} onClick={() => verify.mutate()}>{verify.isPending ? "Sending…" : "Submit for verification"}</button>}
        </>}
      </aside>
    </div>
  );
}
