import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Plus, Star, TrendingUp, X } from "lucide-react";
import { HeroRipples } from "@/components/wb/hero-ripples";
import { placeholderBySrc, type WbImage } from "@/lib/wb-images";

/** Loose link target: the info pages link to many routes and params, so typing is relaxed here only. */
export function WLink({ to, hash, ...rest }: { to: string; hash?: string; className?: string; children: ReactNode; onClick?: () => void; "data-tone"?: string; onMouseMove?: React.MouseEventHandler; onMouseLeave?: React.MouseEventHandler }) {
  const L = Link as unknown as React.ComponentType<Record<string, unknown>>;
  const p = to.startsWith("/info/") && to !== "/info/pricing" ? { to: "/info/$slug", params: { slug: to.slice(6) } } : { to };
  return <L {...p} {...(hash ? { hash } : {})} {...rest} />;
}

export function trackGlow(e: React.MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}
export function magnet(e: React.MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--tx", `${(e.clientX - r.left - r.width / 2) * 0.18}px`);
  e.currentTarget.style.setProperty("--ty", `${(e.clientY - r.top - r.height / 2) * 0.3}px`);
}
export function unmagnet(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.setProperty("--tx", "0px");
  e.currentTarget.style.setProperty("--ty", "0px");
}
export const Bold = ({ t }: { t: string }) => (<span className="hover-bold" data-label={t}><span>{t}</span></span>);

export function Words({ text, delay = 0, step = 45 }: { text: string; delay?: number; step?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i}><span className="word-mask"><span className="word" style={{ animationDelay: `${delay + i * step}ms` }}>{w}</span></span>{" "}</span>
      ))}
    </>
  );
}

export function SplitBtn({ children, tone = "dark", to }: { children: ReactNode; tone?: "dark" | "light"; to: string }) {
  return (
    <WLink to={to} className="btn-split" data-tone={tone}>
      <span>{children}</span>
      <span className="btn-split-box"><ChevronRight className="h-4 w-4" /></span>
    </WLink>
  );
}
export function DarkBtn({ to, children, compact }: { to: string; children: ReactNode; compact?: boolean }) {
  return <WLink to={to} className={`btn-dark${compact ? " btn-compact" : ""}`} onMouseMove={magnet} onMouseLeave={unmagnet}>{children}<ArrowRight className="btn-arrow h-4 w-4" /></WLink>;
}
export function Badge({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "night" | "glass" | "paper" }) {
  return <span className="badge" data-tone={tone}>{children}</span>;
}

/** A picture that falls back to its gradient if the file is missing or slow. */
export function Pic({ img, className, eager }: { img: WbImage; className?: string; eager?: boolean }) {
  const [bad, setBad] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => { const i = ref.current; if (i && i.complete && i.naturalWidth === 0) setBad(true); }, []);
  // No file (or a file that failed): the gradient is the picture, so nothing can appear broken.
  if (!img.src || bad) {
    return <div role="img" aria-label={img.alt} className={className} style={{ background: img.ph, backgroundSize: "cover" }} />;
  }
  return (
    <img
      ref={ref}
      src={img.src}
      alt={img.alt}
      width={1920}
      height={1088}
      loading={eager ? undefined : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      onError={() => setBad(true)}
      style={{ background: placeholderBySrc[img.src] ?? img.ph }}
      className={className}
    />
  );
}

export function PageArt({ img }: { img: WbImage }) {
  return (
    <div className="page-art" style={{ background: img.ph }}>
      <Pic img={img} eager className="hero-photo hero-paint absolute inset-0 h-full w-full" />
      <div className="hero-shade absolute inset-0" />
      <div className="grain absolute inset-0" />
      <div className="hero-fade absolute inset-x-0 bottom-0 h-40" />
    </div>
  );
}

/** Photographic hero used by guide, company and help pages (copy sits over the painted picture). */
export function PageHero({ img, eyebrow, title, description, align = "center", children, aside }: { img: WbImage; eyebrow?: ReactNode; title: ReactNode; description: ReactNode; align?: "center" | "left"; children?: ReactNode; aside?: ReactNode }) {
  const left = align === "left";
  return (
    <section className="page-hero home-style-hero">
      <PageArt img={img} />
      <HeroRipples />
      <div className={`page-hero-body relative mx-auto w-[var(--site-w)] max-w-full pb-14 text-cream ${left ? "" : "text-center"}`}>
        <div className={left && aside ? "grid items-end gap-12 lg:grid-cols-[1.25fr_1fr]" : ""}>
          <div className={left ? "text-left" : ""}>
            {eyebrow && <span className="chip-dark rise mb-6">{eyebrow}</span>}
            <h1 className={`hero-title rise ${left ? "max-w-4xl" : "mx-auto max-w-6xl"}`}>{title}</h1>
            <div className={`hero-description rise mt-5 max-w-3xl ${left ? "" : "mx-auto"}`}>{description}</div>
            {children}
          </div>
          {left && aside}
        </div>
      </div>
    </section>
  );
}

/**
 * Adds `.in` to every `.reveal` block once it is on (or above) the screen. Works for blocks that are added later,
 * after a client-side navigation, and never leaves one hidden.
 */
export function useReveal(key: string) {
  useEffect(() => {
    const pending = () => Array.from(document.querySelectorAll<HTMLElement>(".wb .reveal:not(.in)"));
    const sweep = () => pending().forEach((e) => { const r = e.getBoundingClientRect(); if (r.top < window.innerHeight * 0.92) e.classList.add("in"); });
    let raf = 0;
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sweep); };
    const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.05 });
    const watch = () => pending().forEach((el) => io?.observe(el));
    watch(); later();
    const mo = new MutationObserver(() => { watch(); later(); });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", later, { passive: true });
    window.addEventListener("resize", later);
    const t1 = setTimeout(sweep, 300), t2 = setTimeout(sweep, 1200);
    // Last resort: nothing stays invisible for more than a few seconds.
    const t3 = setTimeout(() => pending().forEach((e) => e.classList.add("in")), 4000);
    return () => { io?.disconnect(); mo.disconnect(); cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); window.removeEventListener("scroll", later); window.removeEventListener("resize", later); };
  }, [key]);
}

/* ---------- Testimonials: Webbora's endless marquee, with Hodii agents ---------- */
export type Review = { q: string; who: string; role: string; win: string };
export const agentReviews: Review[] = [
  { q: "I used to chase leads across three WhatsApp groups. Now enquiries land in one inbox with the property already attached, and I answer them from my phone.", who: "Wanjiku Kariuki", role: "Agent · Kilimani", win: "One inbox" },
  { q: "Verification took two days and my listings started getting noticeably more calls. People trust the badge, and it shows in the quality of enquiries.", who: "Hassan Abdalla", role: "Director · Nyali Homes", win: "Verified badge" },
  { q: "Boosting a single listing for a week was cheaper than a newspaper advert, and we could see the views climbing every day.", who: "Grace Atieno", role: "Sales lead · Kisumu Realty", win: "Clear results" },
  { q: "Adding my team took minutes. Each agent has their own access and I decide who can edit, publish or see payments.", who: "Brian Mutua", role: "Principal · Mutua & Partners", win: "Team roles" },
  { q: "Our new development launched with a full page, a map pin and a floor plan. Serious buyers found us within the first week.", who: "Sheila Chebet", role: "Developer · Eldoret Gardens", win: "Developments" },
  { q: "The listing form saves as I go. When my signal dropped halfway through, I came back and nothing was lost.", who: "Peter Ndung'u", role: "Landlord · Ruiru", win: "Autosave" },
  { q: "Tenants arrive already knowing the rent, deposit and exact location. Fewer wasted viewings for everyone.", who: "Aisha Omar", role: "Property manager · Mombasa", win: "Fewer wasted viewings" },
  { q: "Reporting a fake listing took one minute, and the team replied the same day. That is why I list here.", who: "Daniel Kiprop", role: "Agent · Nakuru", win: "Fast reports" },
];

export function Reviews({ title = "What agents say about Hodii", items = agentReviews }: { title?: string; items?: Review[] }) {
  const loop = [...items, ...items];
  return (
    <section className="reviews-sec" aria-label="Agent reviews">
      <div className="mx-auto max-w-3xl px-5 text-center">
        <h2 className="reveal display-title">{title}</h2>
      </div>
      <div className="reviews-viewport mt-10">
        <div className="reviews-track">
          {loop.map((r, i) => (
            <figure key={i} className="review-card" aria-hidden={i >= items.length}>
              <div className="flex items-center justify-between gap-3">
                <div className="review-stars" aria-label="5 out of 5 stars">{Array.from({ length: 5 }).map((_, s) => <Star key={s} className="h-4 w-4" />)}</div>
                <span className="review-win"><TrendingUp className="h-3.5 w-3.5" />{r.win}</span>
              </div>
              <blockquote className="review-q">“{r.q}”</blockquote>
              <figcaption className="review-foot">
                <span className="review-avatar" aria-hidden="true">{r.who.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                <span><span className="block font-medium">{r.who}</span><span className="block text-[0.85rem] opacity-60">{r.role}</span></span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ on the painted-clouds background ---------- */
export type Qa = { q: string; a: string };
export function Faq({ items, title = "Frequently asked questions", cta, ctaTo = "/info/contact-us", ctaLabel = "Talk to us" }: { items: Qa[]; title?: string; cta?: string; ctaTo?: string; ctaLabel?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="sec-clouds">
      <CloudsBg />
      <div className="relative mx-auto w-[var(--site-w)] max-w-full">
        <div className="mx-auto max-w-2xl text-center"><h2 className="reveal display-title">{title}</h2></div>
        <div className="mx-auto mt-14 flex max-w-3xl flex-col gap-3">
          {items.map((f, i) => (
            <div key={f.q} className="faq-card" data-open={open === i}>
              <button type="button" id={`faq-question-${i}`} className="faq-q" aria-expanded={open === i} aria-controls={`faq-answer-${i}`} onClick={() => setOpen((c) => (c === i ? null : i))}>
                <span className="mr-5 text-[0.85rem] tabular-nums opacity-40">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 text-left">{f.q}</span>
                <span className="faq-icon" aria-hidden="true">{open === i ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span>
              </button>
              <div id={`faq-answer-${i}`} className="faq-a" role="region" aria-labelledby={`faq-question-${i}`} aria-hidden={open !== i}><div><p className="pb-6 pl-[3.6rem] pr-14 text-[1rem] leading-relaxed opacity-65">{f.a}</p></div></div>
            </div>
          ))}
        </div>
        <div className="reveal mt-14 text-center">
          <p className="text-[clamp(1.25rem,2vw,1.6rem)] font-medium">{cta ?? "Still not sure about something? Talk to our team."}</p>
          <div className="mt-6 flex justify-center"><SplitBtn to={ctaTo}>{ctaLabel}</SplitBtn></div>
        </div>
      </div>
    </section>
  );
}
import { paintings } from "@/lib/wb-images";
function CloudsBg() {
  return <Pic img={paintings.clouds} className="sec-clouds-img" />;
}

export const hodiiFaqs: Qa[] = [
  { q: "Is it free to search and enquire?", a: "Yes. Searching, saving homes and sending enquiries are free for everyone. You only pay if you list and want extra visibility." },
  { q: "How do I know a listing is real?", a: "Every listing belongs to a named agency or owner. Verified agencies carry a badge, and any listing can be reported in one tap. We remove those that mislead." },
  { q: "Can I list a property for free?", a: "Yes. Every agency and owner can publish Basic listings for free, up to a limit. Boosts and Premium packages lift the limit and move listings up." },
  { q: "How do I pay for a boost or package?", a: "By M-Pesa, from your dashboard. You see the exact amount before you confirm, and a receipt afterwards." },
  { q: "How long does verification take?", a: "Usually one to two working days after you submit your documents. You can list while you wait." },
  { q: "Can my whole team use one agency account?", a: "Yes. Invite team members and give each a role, or pick exactly what each person may do: edit, publish, see payments or manage the team." },
];

/** Section wrapper that matches Webbora's wide content blocks. */
export function Wrap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-[var(--site-w)] max-w-full ${className}`}>{children}</div>;
}
