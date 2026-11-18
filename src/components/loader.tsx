/** Hodii's one loading indicator: a brand-gradient ring orbiting the house mark. Used for every loading state. */
type Size = "xs" | "sm" | "md" | "lg";
const SIZES: Record<Size, { size: string; stroke: string }> = {
  xs: { size: "1rem", stroke: "2px" },
  sm: { size: "1.9rem", stroke: "2.5px" },
  md: { size: "3rem", stroke: "3px" },
  lg: { size: "4.5rem", stroke: "3.5px" },
};

export function Loader({ size = "md", label, className = "" }: { size?: Size; label?: string; className?: string }) {
  const s = SIZES[size];
  const ring = (
    <span className="loader" data-size={size} style={{ ["--loader-size" as string]: s.size, ["--loader-stroke" as string]: s.stroke }} aria-hidden>
      <span className="loader-track" />
      <span className="loader-glow" />
      <span className="loader-ring" />
      <svg viewBox="0 0 24 24" className="loader-moon" fill="currentColor">
        <path d="M12 3.2 2.5 11.5h2.8V20a1 1 0 0 0 1 1h4v-5.5a1.7 1.7 0 0 1 3.4 0V21h4a1 1 0 0 0 1-1v-8.5h2.8L12 3.2Z" />
      </svg>
    </span>
  );
  if (size === "xs") return <span role="status" aria-label={label ?? "Loading"} className={`inline-flex ${className}`}>{ring}</span>;
  return (
    <span role="status" aria-label={label ?? "Loading"} className={`inline-flex flex-col items-center gap-3 ${className}`}>
      {ring}
      {label && <span className="loader-label">{label}</span>}
    </span>
  );
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
