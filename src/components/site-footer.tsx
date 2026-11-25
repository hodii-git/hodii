import { Link } from "@tanstack/react-router";
import { Mail, MapPin } from "lucide-react";
import { HodiiLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { footerSections, slugify, type FooterColumn } from "@/data/site-content";
import { categorySearch } from "@/lib/search-url";
import { BRAND } from "@/lib/brand";

const LINK = "transition hover:text-foreground";

function FooterLink({ label, kind }: { label: string; kind: FooterColumn["kind"] }) {
  if (label === "New developments") return <Link to="/developments" className={LINK}>{label}</Link>;
  if (label === "Neighbourhoods") return <Link to="/neighbourhoods" className={LINK}>{label}</Link>;
  const c = kind === "section" ? categorySearch(label) : null;
  return c ? (
    <Link to="/properties" search={c.search} className={LINK}>{label}</Link>
  ) : (
    <Link to="/info/$slug" params={{ slug: slugify(label) }} className={LINK}>{label}</Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-border bg-muted/60">
      <div className="w-full px-4 py-10 md:px-6 md:py-12 xl:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[1fr_1.8fr] lg:gap-14">
          <div>
            <Link to="/" className="flex items-center gap-2 text-2xl font-extrabold text-primary">
              <HodiiLogo size="h-8 w-8" />
              {BRAND.wordmark}
            </Link>
            <p className="mt-4 max-w-xs text-muted-foreground">
              {BRAND.tagline}. Homes, land and commercial space for sale and to rent, from verified agencies and owners.
            </p>
            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {BRAND.address}</p>
              <a href={`mailto:${BRAND.emails.general}`} className="flex items-center gap-2 hover:text-foreground"><Mail className="h-4 w-4" /> {BRAND.emails.general}</a>
            </div>
            <Button asChild className="footer-list-btn mt-6 h-11 rounded-full border-0 px-6 text-base font-bold text-white shadow-none hover:opacity-90">
              <Link to="/list-property">List a property</Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {footerSections.map((col) => (
              <div key={col.heading} className="footer-group rounded-2xl p-4 sm:p-5 lg:p-6">
                <h2 className="text-sm font-bold">{col.heading}</h2>
                <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
                  {col.links.map((link) => (
                    <li key={link}><FooterLink label={link} kind={col.kind} /></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t pt-6 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} {BRAND.legalName}. All rights reserved.</span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {["Privacy", "Terms", "Cookies", "Accessibility"].map((l) => (
              <Link key={l} to="/info/$slug" params={{ slug: slugify(l) }} className={LINK}>{l}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
