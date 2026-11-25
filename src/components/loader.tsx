/** Hodii's one loading indicator: the logo square, its house drawing itself, with a light orbiting it. Used for every loading state. */
type Size = "xs" | "sm" | "md" | "lg";
const SIZES: Record<Size, { size: string; stroke: string }> = {
  xs: { size: "1rem", stroke: "2px" },
  sm: { size: "1.9rem", stroke: "2.5px" },
  md: { size: "3rem", stroke: "3px" },
  lg: { size: "4.5rem", stroke: "3.5px" },
};

export function Loader({ size = "md", label, className = "" }: { size?: Size; label?: string; className?: string }) {
  const s = SIZES[size];
  const mark = size === "xs" ? (
    <span className="hl-spin" aria-hidden style={{ ["--hl" as string]: s.size }} />
  ) : (
    <span className="hl" aria-hidden style={{ ["--hl" as string]: s.size }}>
      <svg viewBox="0 0 32 32" className="hl-svg">
        <rect width="32" height="32" rx="9" className="hl-box" />
        <path d="M7 15.5 16 8l9 7.5V24a1 1 0 0 1-1 1h-5v-6h-6v6H8a1 1 0 0 1-1-1z" pathLength="100" className="hl-house" />
      </svg>
    </span>
  );
  if (size === "xs") return <span role="status" aria-label={label ?? "Loading"} className={`inline-flex ${className}`}>{mark}</span>;
  return <span role="status" aria-label={label ?? "Loading"} className={`inline-flex flex-col items-center gap-3 ${className}`}>{mark}</span>;
}

/** Centred loader filling a content area (page or panel). */
export function LoaderBlock({ label = "Loading", className = "py-16", size = "md" }: { label?: string; className?: string; size?: Size }) {
  return <div className={`grid w-full place-items-center ${className}`}><Loader size={size} label={label} /></div>;
}

/** Whole-page pending state used by the router. */
export function PageLoader() {
  return (
    <main aria-busy="true" className="grid min-h-[70vh] w-full flex-1 place-items-center px-4 pt-28 pb-24">
      <Loader size="lg" label="Loading" />
    </main>
  );
}
