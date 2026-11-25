import { BRAND } from "@/lib/brand";

/** The one Hodii mark (the squared header's): a dark rounded square with a house and an open doorway. Used everywhere. */
export function HodiiLogo({ size = "h-8 w-8" }: { size?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={`${BRAND.name} logo`} className={`logo-mark shrink-0 ${size}`}>
      <rect width="32" height="32" rx="9" className="fill-foreground" />
      <path d="M7 15.5 16 8l9 7.5V24a1 1 0 0 1-1 1h-5v-6h-6v6H8a1 1 0 0 1-1-1z" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-card" />
    </svg>
  );
}
