import { BRAND } from "@/lib/brand";

/**
 * Hodii mark: a house with an open doorway ("hodi" is Swahili for "may I come in?").
 * Same circular badge API as the old logo so headers and the footer swap it in directly.
 */
export function HodiiLogo({ size = "h-7 w-7" }: { size?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground ${size}`}>
      <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="none" role="img" aria-label={`${BRAND.name} logo`}>
        <path d="M3 11.2 12 3.5l9 7.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 10v9.2c0 .7.6 1.3 1.3 1.3h10.4c.7 0 1.3-.6 1.3-1.3V10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 20.5v-4.6a2 2 0 0 1 4 0v4.6" fill="currentColor" />
      </svg>
    </span>
  );
}
