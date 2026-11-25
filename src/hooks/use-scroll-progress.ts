import { useEffect, useState } from "react";

/** 0 at the top of the page rising to 1 after `range` pixels of scroll; drives the landing page's collapsing search. */
export function useScrollProgress(range = 160) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setP(Math.min(1, Math.max(0, window.scrollY / range)))); };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, [range]);
  return p;
}
