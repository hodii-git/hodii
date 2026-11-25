import { Loader } from "@/components/loader";
import { BadgeCheck, Flag } from "lucide-react";
import { BLUE_GRADIENT_H, PhoneGlyph, SendMark, WhatsAppGlyph } from "@/components/property/dock-icons";
import { Sel } from "@/components/ui/sel";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { reportListing, revealListingContact, sendEnquiry } from "@/lib/properties.functions";
import { ENQUIRY_LIMITS } from "@/lib/mongodb/limits";
import { REPORT_REASONS } from "@/lib/mongodb/taxonomy";
import type { PropertyDetail } from "@/lib/property-dto";
import { visitorId } from "@/lib/visitor";

const field = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
const waLink = (num: string, ref: string, title: string) => `https://wa.me/${num.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello, I am interested in ${title} (ref ${ref}) on Hodii.`)}`;

/** Agent card, call/WhatsApp buttons (numbers fetched on click), enquiry form and the report link. */
export function ContactPanel({ p, shown: extShown, busy: extBusy, onReveal }: { p: PropertyDetail; shown?: { phone: string; whatsapp: string } | null; busy?: "phone" | "whatsapp" | null; onReveal?: (via: "phone" | "whatsapp") => Promise<void> | void }) {
  const { user } = useAuth();
  const [localShown, setLocalShown] = useState<{ phone: string; whatsapp: string } | null>(null);
  const [localBusy, setLocalBusy] = useState<"phone" | "whatsapp" | null>(null);
  const shown = extShown !== undefined ? extShown : localShown;
  const busy = extBusy !== undefined ? extBusy : localBusy;

  const reveal = async (via: "phone" | "whatsapp") => {
    if (onReveal) { await onReveal(via); return; }
    setLocalBusy(via);
    try {
      const r = await revealListingContact({ data: { propertyId: p.id, via, visitorId: visitorId() } });
      setLocalShown({ phone: r.phone, whatsapp: r.whatsapp });
      if (via === "whatsapp") window.open(waLink(r.whatsapp, p.referenceCode, p.title), "_blank", "noopener,noreferrer");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load the contact details"); }
    finally { setLocalBusy(null); }
  };

  return (
    <aside id="contact" aria-label="Contact" data-tour="contact" className="glass scroll-mt-20 space-y-5 rounded-3xl p-5">
      {p.agencyProfile && (
        <div className="flex items-center gap-3">
          <Link to="/agency/$slug" params={{ slug: p.agencyProfile.slug }} aria-label={`${p.agencyProfile.name} profile`} className="shrink-0">{p.agencyProfile.logo ? <img src={p.agencyProfile.logo} alt="" loading="lazy" decoding="async" width={48} height={48} className="h-12 w-12 rounded-xl bg-white object-contain p-1" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-lg font-extrabold">{p.agencyProfile.name[0]}</div>}</Link>
          <div className="min-w-0">
            <Link to="/agency/$slug" params={{ slug: p.agencyProfile.slug }} className="flex items-center gap-1 font-bold hover:underline"><span className="truncate">{p.agencyProfile.name}</span>{p.agencyProfile.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Verified agency" />}</Link>
            {p.agent && <p className="truncate text-sm text-muted-foreground">{p.agent.name}{p.agent.title ? `, ${p.agent.title}` : ""}</p>}
          </div>
        </div>
      )}
      <div className="grid gap-2">
        {shown ? (
          <a href={`tel:${shown.phone}`} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"><PhoneGlyph className="size-6 shrink-0" />{shown.phone}</a>
        ) : (
          <button type="button" onClick={() => reveal("phone")} disabled={busy !== null} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"><PhoneGlyph className="size-6 shrink-0" />{busy === "phone" ? <Loader size="xs" /> : "Show phone number"}</button>
        )}
        <button type="button" onClick={() => reveal("whatsapp")} disabled={busy !== null} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-input bg-background text-sm font-bold disabled:opacity-60"><WhatsAppGlyph className="size-6 shrink-0" />Contact on WhatsApp</button>
      </div>
      <p className="text-xs text-muted-foreground">Mention reference <strong className="font-bold">{p.referenceCode}</strong> when you call. Never pay a deposit before you have viewed the property.</p>
      <EnquiryForm p={p} defaultName={user?.username ?? ""} defaultEmail={user?.email ?? ""} />
      <ReportButton propertyId={p.id} />
    </aside>
  );
}

function EnquiryForm({ p, defaultName, defaultEmail }: { p: PropertyDetail; defaultName: string; defaultEmail: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (sent) return <div role="status" className="rounded-2xl bg-muted p-4 text-sm"><p className="font-bold">Enquiry sent</p><p className="mt-1 text-muted-foreground">{p.agencyProfile?.name ?? "The agent"} will get back to you using the details you gave.</p></div>;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true); setErr(null);
    try {
      const viewing = v("viewing");
      const r = await sendEnquiry({ data: {
        propertyId: p.id, visitorId: visitorId(), name: v("name"), email: v("email"), phone: v("phone") || null, message: v("message"),
        preferredViewingAt: viewing ? new Date(viewing).toISOString() : null, consent: f.get("consent") === "on" ? true : (false as never), website: v("website"),
      } });
      if (r.ok) setSent(true); else setErr(r.error);
    } catch (e) {
      setErr(e instanceof Error && !/^\[|^\{/.test(e.message) ? e.message : "Please check your details: a name, a valid email and a message of at least 10 characters, and tick the box to agree.");
    } finally { setBusy(false); }
  };

  return (
    <form id="enquiry-form" onSubmit={submit} className="scroll-mt-20 space-y-3 border-t border-border pt-5" aria-label="Send an enquiry">
      <h2 className="text-base font-extrabold">Send an enquiry</h2>
      <div><label htmlFor="eq-name" className="sr-only">Your name</label><input id="eq-name" name="name" required minLength={ENQUIRY_LIMITS.nameMin} maxLength={ENQUIRY_LIMITS.nameMax} defaultValue={defaultName} placeholder="Your name" autoComplete="name" className={field} /></div>
      <div><label htmlFor="eq-email" className="sr-only">Email</label><input id="eq-email" name="email" type="email" required defaultValue={defaultEmail} placeholder="Email" autoComplete="email" className={field} /></div>
      <div><label htmlFor="eq-phone" className="sr-only">Phone (optional)</label><input id="eq-phone" name="phone" type="tel" placeholder="Phone, e.g. 0712 345 678 (optional)" autoComplete="tel" className={field} /></div>
      <div><label htmlFor="eq-msg" className="sr-only">Message</label><textarea id="eq-msg" name="message" required minLength={ENQUIRY_LIMITS.messageMin} maxLength={ENQUIRY_LIMITS.messageMax} rows={4} defaultValue={`Hello, I am interested in ${p.title} (ref ${p.referenceCode}). Is it still available?`} className={field} /></div>
      <div><label htmlFor="eq-view" className="mb-1 block text-xs text-muted-foreground">Preferred viewing time (optional)</label><input id="eq-view" name="viewing" type="datetime-local" className={field} /></div>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4" /><span>I agree that Hodii shares these details with {p.agencyProfile?.name ?? "the agent"} so they can reply. See our <Link to="/info/$slug" params={{ slug: "privacy-policy" }} className="underline">privacy policy</Link>.</span></label>
      {err && <p role="alert" className="text-sm font-semibold text-destructive">{err}</p>}
      <button disabled={busy} style={{ background: BLUE_GRADIENT_H }} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-[0_8px_22px_-8px_rgb(10_171_252/0.7)] transition active:scale-[0.98] disabled:opacity-60">{busy ? <Loader size="xs" label="Sending" /> : <>Send enquiry<SendMark className="size-[18px] shrink-0" /></>}</button>
    </form>
  );
}

function ReportButton({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <p role="status" className="text-center text-xs text-muted-foreground">Thanks. Our team will review this listing.</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"><Flag className="h-3.5 w-3.5" aria-hidden />Report this listing</button>;
  return (
    <form className="space-y-2 rounded-2xl bg-muted p-3" onSubmit={async (e) => {
      e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true);
      try {
        const r = await reportListing({ data: { propertyId, reason: String(f.get("reason")) as never, details: String(f.get("details") ?? "").trim() || null } });
        if (r.ok) setDone(true); else toast.error(r.error);
      } catch { toast.error("Could not send the report"); } finally { setBusy(false); }
    }}>
      <label htmlFor="rp-reason" className="text-sm font-bold">What is wrong?</label>
      <Sel id="rp-reason" name="reason" required className={field} defaultValue="">
        <option value="" disabled>Choose a reason</option>
        {REPORT_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
      </Sel>
      <label htmlFor="rp-details" className="sr-only">Details (optional)</label>
      <textarea id="rp-details" name="details" rows={2} maxLength={1000} placeholder="Details (optional)" className={field} />
      <div className="flex gap-2"><button disabled={busy} className="h-9 flex-1 rounded-xl bg-foreground text-sm font-bold text-background disabled:opacity-60">Send report</button><button type="button" onClick={() => setOpen(false)} className="h-9 rounded-xl border border-input px-3 text-sm">Cancel</button></div>
    </form>
  );
}
