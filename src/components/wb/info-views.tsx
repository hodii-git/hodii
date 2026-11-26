import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowRight, BadgeCheck, BookOpen, Building2, Check, FileText, Home, Mail, MapPin, Search, ShieldCheck, Sparkles, UserCog, Users, Wallet } from "lucide-react";
import type { InfoPage, InfoPageSection } from "@/data/site-content";
import { BRAND, LEGAL_UPDATED } from "@/lib/brand";
import { founder } from "@/data/founder";
import { paintings, type WbImage } from "@/lib/wb-images";
import { useHeroCycle } from "@/lib/hero-cycle";
import { Badge, Bold, DarkBtn, Faq, PageArt, PageHero, Pic, Reviews, SplitBtn, Wrap, WLink, hodiiFaqs, magnet, unmagnet, type Qa } from "@/components/wb/ui";
import { HeroRipples } from "@/components/wb/hero-ripples";
import { WbPage } from "@/components/wb/shell";

const strip = (h: string) => h.replace(/^\d+\.\s*/, "");
const slugId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Renders a section's text: paragraphs, then bullets as ticked tiles. Emails become mail links. */
function linkify(t: string): ReactNode {
  const m = t.match(/^(.*?)([\w.+-]+@[\w-]+\.[\w.]+)(.*)$/);
  if (!m) return t;
  return <>{m[1]}<a className="underline underline-offset-4" href={`mailto:${m[2]}`}>{m[2]}</a>{linkify(m[3] ?? "")}</>;
}
function SectionBody({ s, tiles }: { s: InfoPageSection; tiles?: boolean }) {
  return (
    <>
      {s.body?.map((p, i) => <p key={i} className="mt-4 text-[1.02rem] leading-relaxed opacity-70 first:mt-0">{linkify(p)}</p>)}
      {s.bullets && (
        <ul className={`mt-5 grid gap-3 ${tiles ? "sm:grid-cols-2" : ""}`}>
          {s.bullets.map((b) => (
            <li key={b} className="flex gap-3 rounded-2xl p-3.5 text-[0.98rem] leading-relaxed" style={{ background: "color-mix(in oklab, var(--ink) 4%, transparent)" }}>
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: "var(--mint)", color: "var(--mint-ink)" }}><Check className="h-3.5 w-3.5" /></span>
              <span>{linkify(b)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CtaBand({ title, text, to, label }: { title: string; text: string; to: string; label: string }) {
  return (
    <Wrap className="pb-[clamp(3rem,6vw,5rem)]">
      <div className="cta-band reveal">
        <h2 className="display-title mx-auto max-w-3xl">{title}</h2>
        <p className="lede mx-auto mt-5 max-w-xl">{text}</p>
        <div className="mt-8 flex justify-center"><SplitBtn to={to}>{label}</SplitBtn></div>
      </div>
    </Wrap>
  );
}

/* ================= Guides (Resources) ================= */
const guideLook: Record<string, { img: WbImage; Icon: typeof Home; label: string; faq: Qa[]; cta: { to: string; label: string; text: string } }> = {
  "buying-guide": { img: paintings.valley, Icon: Home, label: "Buying guide", cta: { to: "/properties", label: "Browse homes for sale", text: "When you are ready to look, every listing is tied to a named agency or owner." }, faq: [
    { q: "How much should I budget beyond the price?", a: "Plan for legal fees, stamp duty, valuation, and moving costs on top of the price. Ask your lawyer for a full estimate before you make an offer." },
    { q: "Should I pay a deposit before viewing?", a: "No. Never pay a deposit or fee before you have seen the property and checked who owns it." },
    { q: "How do I check a title?", a: "Ask for a copy of the title and have your advocate run an official search before you pay anything." },
  ] },
  "renting-guide": { img: paintings.peaks, Icon: Building2, label: "Renting guide", cta: { to: "/properties", label: "Browse homes to rent", text: "Filter by county, area, price and bedrooms, and save the ones you like." }, faq: [
    { q: "What should be in a tenancy agreement?", a: "Rent, deposit, notice period, who pays which bills, and the rules about repairs. Read it fully before you sign." },
    { q: "Is it safe to pay rent before viewing?", a: "No. See the place first, then pay through a traceable method and keep every receipt." },
    { q: "Can I get my deposit back?", a: "Yes, if the agreement says so and you leave the place in good condition. Take dated photos on move-in day." },
  ] },
  "selling-and-letting": { img: paintings.pines, Icon: Wallet, label: "Selling and letting", cta: { to: "/list-property", label: "List a property", text: "Publish for free, then boost or go Premium when you want more eyes." }, faq: [
    { q: "What does it cost to list?", a: "Basic listings are free up to a limit. Boosts and Premium packages are paid by M-Pesa." },
    { q: "How do I get more enquiries?", a: "Use clear photos, an honest price and an exact location. Boosting moves a listing up for a set number of days." },
    { q: "Can an agency list for several owners?", a: "Yes. Create an agency account and add your team with the access each person needs." },
  ] },
  "safety-and-fraud": { img: paintings.clouds, Icon: ShieldCheck, label: "Safety and fraud", cta: { to: "/info/report-a-listing", label: "Report a listing", text: "If something looks wrong, tell us. Reports take a minute and we read every one." }, faq: [
    { q: "What are the warning signs of a scam?", a: "A price far below the market, pressure to pay quickly, a refusal to let you view, and requests for money before a viewing." },
    { q: "What should I do if I paid a scammer?", a: "Report it to the police and to your payment provider immediately, then send us the listing link so we can act." },
    { q: "How are listings verified?", a: "Agencies submit documents for review and earn a badge. Any listing can still be reported." },
  ] },
};

export function GuideView({ slug, page }: { slug: string; page: InfoPage }) {
  const look = guideLook[slug]!;
  const secs = (page.sections ?? []).map((x) => ({ ...x, heading: strip(x.heading) }));
  const others = Object.keys(guideLook).filter((k) => k !== slug);
  return (
    <WbPage slug={slug}>
      <PageHero
        img={look.img}
        align="left"
        eyebrow={<><look.Icon className="h-3.5 w-3.5" />{look.label}</>}
        title={page.title}
        description={<p className="max-w-2xl">{page.text}</p>}
        aside={
          <div className="about-ai-panel rise text-left">
            <p className="about-ai-label">In this guide</p>
            <ul className="mt-5 space-y-3.5">
              {secs.slice(0, 5).map((s, i) => (
                <li key={s.heading} className="flex gap-3.5"><span className="step-no" style={{ background: "color-mix(in oklab, var(--cream) 18%, transparent)" }}>{i + 1}</span><a href={`#${slugId(s.heading)}`} className="self-center font-medium"><Bold t={s.heading} /></a></li>
              ))}
            </ul>
          </div>
        }
      />
      <Wrap className="mt-[clamp(2rem,4vw,3.5rem)] grid gap-10 pb-[clamp(4rem,7vw,6rem)] lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">
          <nav className="guide-toc sticky top-32 info-card !p-3" aria-label="Contents">
            <p className="px-3 pb-2 pt-1 text-[0.75rem] font-medium uppercase opacity-50">Contents</p>
            {secs.map((s, i) => <a key={s.heading} href={`#${slugId(s.heading)}`}><span className="tabular-nums opacity-40">{String(i + 1).padStart(2, "0")}</span>{s.heading}</a>)}
          </nav>
        </aside>
        <div className="grid gap-6">
          {secs.map((s, i) => (
            <section key={s.heading} id={slugId(s.heading)} className="reveal info-card scroll-mt-32">
              <div className="mb-5 flex items-center gap-4"><span className="step-no">{i + 1}</span><h2 className="font-display text-[clamp(1.4rem,2.4vw,2rem)] font-semibold">{s.heading}</h2></div>
              <SectionBody s={s} tiles />
            </section>
          ))}
        </div>
      </Wrap>
      <Wrap className="pb-[clamp(3rem,6vw,5rem)]">
        <h2 className="reveal display-title text-center">More guides</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {others.map((k) => { const o = guideLook[k]!; return (
            <WLink key={k} to={`/info/${k}`} className="reveal info-card group block">
              <span className="step-no"><o.Icon className="h-4 w-4" /></span>
              <p className="mt-5 font-display text-xl font-semibold">{o.label}</p>
              <p className="mt-2 text-[0.95rem] opacity-60">{o.cta.text}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-[0.9rem] font-medium">Read the guide<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </WLink>
          ); })}
        </div>
      </Wrap>
      <Faq items={look.faq} title={`${look.label}: common questions`} />
      <CtaBand title={look.cta.label} text={look.cta.text} to={look.cta.to} label={look.cta.label} />
    </WbPage>
  );
}

/* ================= Company pages ================= */
const companyLook: Record<string, { img: WbImage; Icon: typeof Home; reviews?: boolean; faq?: boolean; cta: { to: string; label: string } }> = {
  "list-with-hodii": { img: paintings.pines, Icon: Building2, reviews: true, faq: true, cta: { to: "/list-property", label: "Start listing" } },
  "listing-standards": { img: paintings.clouds, Icon: BadgeCheck, faq: true, cta: { to: "/list-property", label: "List a property" } },
  careers: { img: paintings.valley, Icon: Users, cta: { to: "/info/contact-us", label: "Get in touch" } },
  "press-room": { img: paintings.peaks, Icon: FileText, cta: { to: "/info/contact-us", label: "Contact the press team" } },
  "contact-us": { img: paintings.valley, Icon: Mail, faq: true, cta: { to: "/info/help-centre", label: "Visit the help centre" } },
  advertise: { img: paintings.peaks, Icon: Sparkles, reviews: true, cta: { to: "/info/contact-us", label: "Talk to us" } },
};

export function CompanyView({ slug, page }: { slug: string; page: InfoPage }) {
  const look = companyLook[slug] ?? companyLook["listing-standards"]!;
  const secs = page.sections ?? [];
  return (
    <WbPage slug={slug}>
      <PageHero
        img={look.img}
        eyebrow={<><look.Icon className="h-3.5 w-3.5" />{BRAND.name}</>}
        title={page.title}
        description={<p>{page.text}</p>}
      >
        {page.facts && (
          <div className="rise mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
            {page.facts.map((f) => <div key={f.label} className="stat-chip text-left"><p className="text-[0.75rem] font-medium uppercase opacity-70">{f.label}</p><p className="mt-1 font-medium">{f.value}</p></div>)}
          </div>
        )}
        <div className="rise mt-10"><DarkBtn to={look.cta.to}>{look.cta.label}</DarkBtn></div>
      </PageHero>
      <Wrap className="mt-[clamp(3rem,6vw,5rem)] grid gap-16 pb-[clamp(4rem,7vw,6rem)] lg:gap-24">
        {secs.map((s, i) => (
          <section key={s.heading} className={`reveal grid items-start gap-8 lg:grid-cols-[1fr_1.4fr] ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <div>
              <p className="text-cocoa font-display text-[clamp(3rem,6vw,5rem)] font-semibold leading-none">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="mt-4 font-display text-[clamp(1.6rem,2.8vw,2.4rem)] font-semibold leading-tight">{s.heading}</h2>
            </div>
            <div className="info-card"><SectionBody s={s} /></div>
          </section>
        ))}
      </Wrap>
      {look.reviews && <Reviews />}
      {look.faq ? <Faq items={hodiiFaqs} /> : null}
      <CtaBand title={look.cta.label} text={`${BRAND.name}: ${BRAND.tagline}.`} to={look.cta.to} label={look.cta.label} />
    </WbPage>
  );
}

/* ================= About (with the founder story) ================= */
export function AboutView({ page }: { page: InfoPage }) {
  const { step, selectStep } = useHeroCycle(founder.steps.length);
  const values = page.sections?.find((s) => s.bullets)?.bullets ?? [];
  const why = page.sections?.[0];
  const how = page.sections?.find((s) => /how/i.test(s.heading));
  return (
    <WbPage slug="about-us">
      <section className="page-hero home-style-hero about-hero">
        <PageArt img={paintings.valley} />
        <HeroRipples />
        <div className="page-hero-body about-hero-body relative mx-auto w-[var(--site-w)] max-w-full pb-6 text-cream sm:pb-8 lg:pb-10">
          <div className="grid items-end gap-12 lg:grid-cols-[1.25fr_1fr]">
            <div className="text-left">
              <span className="chip-dark rise"><Sparkles className="h-3.5 w-3.5" />About {BRAND.name}</span>
              <h1 className="mt-6 font-display text-[clamp(2rem,4.2vw,3.5rem)] font-semibold leading-[1.05]" aria-live="polite">
                <span key={`a${step}`} className="rise block" style={{ animationDelay: "50ms" }}>{founder.titles[step]?.[0]}</span>
                <span key={`b${step}`} className="rise block" style={{ animationDelay: "180ms" }}><span className="text-cocoa-hero">{founder.titles[step]?.[1]}</span></span>
              </h1>
              <p key={`p${step}`} className="rise mt-5 max-w-xl text-[clamp(1rem,1.6vw,1.25rem)] text-cream/75" style={{ animationDelay: "320ms" }}>{founder.lines[step]}</p>
              <div className="rise mt-9" style={{ animationDelay: "450ms" }}><DarkBtn to="/properties">Browse properties</DarkBtn></div>
            </div>
            <div className="about-ai-panel rise text-left" style={{ animationDelay: "520ms" }}>
              <p className="about-ai-label">What we stand for</p>
              <ul className="mt-5 space-y-5">
                {[{ I: ShieldCheck, t: "Named, accountable listers", d: "Every listing belongs to an agency or owner who stands behind it." }, { I: MapPin, t: "Exact locations, plain prices", d: "Shillings, size, features and a pin on the map." }, { I: BadgeCheck, t: "Easy to report", d: "One tap on any listing, and we read every report." }].map(({ I, t, d }) => (
                  <li key={t} className="flex gap-3.5"><span className="about-ai-icon"><I className="h-4 w-4" /></span><span><span className="block font-semibold">{t}</span><span className="block text-sm text-cream/70">{d}</span></span></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="about-steps rise mt-10 grid max-w-full grid-cols-2 gap-6 md:mt-16 md:grid-cols-4" style={{ animationDelay: "600ms" }}>
            {founder.steps.map((t, i) => (
              <button key={t} type="button" className="step text-[0.9rem]" data-active={step === i} onClick={() => selectStep(i)}><span className="mr-1.5 opacity-60">{i + 1}.</span><Bold t={t} /></button>
            ))}
          </div>
        </div>
      </section>

      <Wrap className="pt-[clamp(4rem,8vw,7rem)] pb-[clamp(4rem,8vw,7rem)]">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="reveal display-title text-cocoa">About us</h2>
          <p className="reveal lede mx-auto mt-8 max-w-2xl">{page.text}</p>
          {why?.body?.[1] && <p className="reveal lede mx-auto mt-6 max-w-2xl">{why.body[1]}</p>}
          <div className="reveal story-stats mt-16">
            {[{ n: "47", l: "Counties covered" }, { n: "4", l: "Kinds of property" }, { n: "100%", l: "Named listers" }].map((f) => (
              <div key={f.l}><p className="text-cocoa font-display text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-none">{f.n}</p><p className="mt-2 text-[0.9rem] opacity-60">{f.l}</p></div>
            ))}
          </div>
        </div>
      </Wrap>

      {/* Founder story */}
      <Wrap className="pb-[clamp(4rem,8vw,7rem)]">
        <div className="reveal info-card grid items-center gap-10 !p-6 sm:!p-10 lg:grid-cols-[1fr_1.35fr] lg:gap-14">
          <div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem]" style={{ background: "var(--ph-founder)" }}>
              <Pic img={paintings.founder} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-cream" style={{ background: "linear-gradient(0deg, color-mix(in oklab, var(--ink) 75%, transparent), transparent)" }}>
                <p className="font-display text-lg font-semibold">{founder.name}</p><p className="text-sm opacity-80">{founder.role}</p>
              </div>
            </div>
          </div>
          <div>
            <Badge>Our story</Badge>
            <h2 className="display-title mt-5 !text-[clamp(2rem,4vw,3.4rem)]">Why we built Hodii</h2>
            <blockquote className="mt-6 border-l-2 pl-5 font-display text-[clamp(1.15rem,1.8vw,1.5rem)] leading-snug" style={{ borderColor: "var(--cocoa-2)" }}>“{founder.quote}”</blockquote>
            {founder.story.map((p, i) => <p key={i} className="mt-5 text-[1.02rem] leading-relaxed opacity-70">{p}</p>)}
          </div>
        </div>
      </Wrap>

      {values.length > 0 && (
        <Wrap className="pb-[clamp(4rem,8vw,7rem)]">
          <h2 className="reveal display-title text-center">What we stand for</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((v, i) => { const [h, ...r] = v.split(" — "); return (
              <div key={v} className="reveal info-card"><span className="step-no">{i + 1}</span><p className="mt-5 font-display text-xl font-semibold">{h}</p><p className="mt-2 text-[0.95rem] opacity-65">{r.join(" — ")}</p></div>
            ); })}
          </div>
        </Wrap>
      )}
      {how && (
        <Wrap className="pb-[clamp(4rem,8vw,7rem)]"><div className="reveal info-card mx-auto max-w-3xl"><h2 className="font-display text-[clamp(1.5rem,2.6vw,2.2rem)] font-semibold">{how.heading}</h2><div className="mt-5"><SectionBody s={how} /></div></div></Wrap>
      )}
      <Reviews />
      <Faq items={hodiiFaqs} />
      <CtaBand title="Come on in" text="Search homes, land and commercial space, or list yours." to="/properties" label="Browse properties" />
    </WbPage>
  );
}

/* ================= Legal pages ================= */
export function LegalView({ slug, page }: { slug: string; page: InfoPage }) {
  const wash = ["privacy-policy", "privacy", "cookie-policy", "cookies"].includes(slug) ? "pines" : "peaks";
  const secs = page.sections ?? [];
  return (
    <WbPage slug={slug}>
      <div className={`legal-bg legal-bg-${wash}`} aria-hidden="true"><div className="legal-wash" /><div className="sec-pines-shade" /><div className="grain absolute inset-0" /></div>
      <section className={`page-hero legal-hero sec-pines legal-hero-${wash}`}>
        <div className="page-art" aria-hidden="true" />
        <div className="page-hero-body relative mx-auto w-[var(--site-w)] max-w-full pb-[clamp(2.5rem,4vw,3.5rem)]">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="reveal display-title mt-6">{page.title}</h1>
            <p className="reveal lede mx-auto mt-6 max-w-lg">{page.text.replace(/\s*Last updated:? [^.]*\.?\s*$/, "")}</p>
            <p className="reveal mt-4 text-[0.85rem] opacity-60">Last updated: {LEGAL_UPDATED}</p>
          </div>
        </div>
      </section>
      <section className="legal-body mx-auto w-[var(--site-w)] max-w-full pb-14 lg:pb-20">
        <div className="mx-auto grid max-w-3xl gap-5">
          {secs.map((b, n) => (
            <div key={b.heading} className="reveal footer-panel legal-glass rounded-2xl p-6 sm:p-8">
              <h2 className="font-display text-[1.35rem] font-semibold">{/^\d+\./.test(b.heading) ? b.heading : `${n + 1}. ${b.heading}`}</h2>
              {b.body?.map((t, i) => <p key={i} className="footer-muted mt-3 text-[0.95rem] leading-relaxed">{linkify(t)}</p>)}
              {b.bullets && <ul className="footer-muted mt-3 list-disc space-y-2 pl-5 text-[0.95rem] leading-relaxed">{b.bullets.map((t) => <li key={t}>{linkify(t)}</li>)}</ul>}
            </div>
          ))}
          <div className="reveal footer-panel legal-glass rounded-2xl p-6 text-center sm:p-8">
            <p className="footer-muted text-[0.95rem]">For questions about this document, please contact us.</p>
            <WLink to="/info/contact-us" className="btn-dark btn-compact mt-5">Contact us<ArrowRight className="btn-arrow h-4 w-4" /></WLink>
          </div>
        </div>
      </section>
    </WbPage>
  );
}

/* ================= Support pages ================= */
const supportIcons = [Search, Building2, UserCog, ShieldCheck, BookOpen];
export function SupportView({ slug, page }: { slug: string; page: InfoPage }) {
  const [q, setQ] = useState(() => { try { const m = /^#q=(.*)$/.exec(window.location.hash); return m ? decodeURIComponent(m[1] ?? "") : ""; } catch { return ""; } });
  const secs = (page.sections ?? []).filter((s) => !q || (s.heading + (s.body ?? []).join(" ") + (s.bullets ?? []).join(" ")).toLowerCase().includes(q.toLowerCase()));
  const img = slug === "help-centre" ? paintings.clouds : slug === "report-a-listing" ? paintings.pines : paintings.peaks;
  const faq = slug === "help-centre" ? hodiiFaqs : null;
  return (
    <WbPage slug={slug}>
      <PageHero img={img} eyebrow={<><BookOpen className="h-3.5 w-3.5" />Support</>} title={page.title} description={<p>{page.text}</p>}>
        {slug === "help-centre" && (
          <div className="rise mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-full px-5 py-3.5 text-left text-foreground" style={{ background: "color-mix(in oklab, var(--paper) 92%, transparent)" }}>
            <Search className="h-5 w-5 opacity-50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for an answer" aria-label="Search the help centre" className="flex-1 bg-transparent outline-none" />
          </div>
        )}
      </PageHero>
      <Wrap className="mt-[clamp(2rem,4vw,3.5rem)] pb-[clamp(4rem,7vw,6rem)]">
        {slug === "help-centre" && !q && (
          <div className="mb-10">
            <h2 className="reveal mb-4 font-display text-2xl font-semibold">Guides and walkthroughs</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { t: "Finding a home", d: "Searching, filters, saving and comparing.", to: "/help", search: { for: "user" } },
                { t: "For agencies", d: "Listings, space, Premium, team and verification.", to: "/help", search: { for: "agency" } },
                { t: "Buying guide", d: "From budget to keys, step by step.", to: "/info/buying-guide" },
                { t: "Renting guide", d: "Deposits, viewings and lease basics.", to: "/info/renting-guide" },
                { t: "Selling and letting", d: "Pricing, photos and getting enquiries.", to: "/info/selling-and-letting" },
                { t: "Safety and fraud", d: "How to spot scams and stay safe.", to: "/info/safety-and-fraud" },
                { t: "Report a listing", d: "Tell us about something that looks wrong.", to: "/info/report-a-listing" },
                { t: "Manage your account", d: "Profile, notifications and your data.", to: "/info/manage-account" },
              ].map((g) => (
                <Link key={g.t} to={g.to as string} {...("search" in g ? { search: g.search } : {})} className="reveal guide-card group">
                  <p className="font-display text-lg font-semibold">{g.t}</p><p className="mt-1.5 text-sm opacity-65">{g.d}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">Open<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          {secs.map((s, i) => { const I = supportIcons[i % supportIcons.length]!; return (
            <section key={s.heading} className="reveal info-card">
              <div className="mb-5 flex items-center gap-4"><span className="step-no"><I className="h-4 w-4" /></span><h2 className="font-display text-[clamp(1.25rem,2vw,1.6rem)] font-semibold">{s.heading}</h2></div>
              <SectionBody s={s} />
            </section>
          ); })}
          {secs.length === 0 && <p className="info-card md:col-span-2">Nothing matches “{q}”. Try a shorter word, or write to {BRAND.emails.support}.</p>}
        </div>
        {slug === "manage-account" && (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[{ t: "Your profile", d: "Name, saved homes and your data.", to: "/profile" }, { t: "Notifications", d: "Replies and updates in one place.", to: "/notifications" }, { t: "Saved properties", d: "The homes you want to come back to.", to: "/saved" }].map((a) => (
              <WLink key={a.t} to={a.to} className="reveal info-card group block"><p className="font-display text-xl font-semibold">{a.t}</p><p className="mt-2 text-[0.95rem] opacity-60">{a.d}</p><span className="mt-4 inline-flex items-center gap-2 text-[0.9rem] font-medium">Open<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></WLink>
            ))}
          </div>
        )}
      </Wrap>
      {faq && <Faq items={faq} />}
      <CtaBand title="Still need a hand?" text={`Write to ${BRAND.emails.support}. We answer within two working days.`} to="/info/contact-us" label="Contact us" />
    </WbPage>
  );
}
