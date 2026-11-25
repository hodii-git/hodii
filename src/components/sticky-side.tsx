import { useEffect, useRef, type ReactNode } from "react";

/** A sidebar that stays put only once its whole bottom edge is on screen: it never sticks while its bottom is still below the fold. */
export function StickySide({ children, offset = 96, className = "" }: { children: ReactNode; offset?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => { const h = el.offsetHeight; el.style.top = `${Math.min(offset, window.innerHeight - h - 24)}px`; };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); window.addEventListener("resize", fit);
    return () => { ro.disconnect(); window.removeEventListener("resize", fit); };
  }, [offset]);
  return <div ref={ref} className={`lg:sticky lg:self-start ${className}`}>{children}</div>;
}
