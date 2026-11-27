import { useId } from "react";
import { BRAND } from "@/lib/brand";

/** The Hodii mark: a gradient rounded square with a house and an open doorway (or, with `outline`, just the house line in the brand gradient). */
export function HodiiLogo({ size = "h-8 w-8", outline = false }: { size?: string; /** Just the house outline in the brand gradient: for headers, menus and dashboards where the name sits beside it. The filled block stays for favicons, loaders and splash screens. */ outline?: boolean }) {
  const gid = useId();
  if (outline) {
    return (
      <>
        <svg viewBox="5 6 22 21" role="img" aria-label={`${BRAND.name} logo`} className={`logo-mark shrink-0 ${size}`}>
        <defs><linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="7" y1="8" x2="25" y2="25"><stop offset="0" stopColor="#fd267a" /><stop offset="1" stopColor="#ff6036" /></linearGradient></defs>
        <path d="M7 15.5 16 8l9 7.5V24a1 1 0 0 1-1 1h-5v-6h-6v6H8a1 1 0 0 1-1-1z" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" stroke={`url(#${gid})`} />
        </svg>
      </>
    );
  }
  return (
    <svg style={{ background: "var(--brand-gradient)", borderRadius: "28%" }} viewBox="0 0 32 32" role="img" aria-label={`${BRAND.name} logo`} className={`logo-mark shrink-0 ${size}`}>
      <path d="M7 15.5 16 8l9 7.5V24a1 1 0 0 1-1 1h-5v-6h-6v6H8a1 1 0 0 1-1-1z" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" stroke="#fff" />
    </svg>
  );
}
