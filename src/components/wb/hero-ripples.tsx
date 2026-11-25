import { useEffect, useRef, type CSSProperties } from "react";

/** The same fluted glass and travelling light on every photographic hero. */
export function HeroRipples() {
  const ribsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ribs = ribsRef.current;
    const hero = ribs?.parentElement;
    if (!ribs || !hero) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let pointer: number | null = null;
    let frame = 0;
    let light = 0;
    const start = performance.now();

    const move = (event: MouseEvent) => {
      const rect = hero.getBoundingClientRect();
      pointer = (event.clientX - rect.left) / rect.width;
      hero.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      hero.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    const leave = () => {
      pointer = null;
      hero.style.removeProperty("--mx");
      hero.style.removeProperty("--my");
    };
    const loop = (now: number) => {
      if (reduced.matches) return;
      const progress = ((now - start) / 6000) % 2;
      const sweep = (progress < 1 ? progress : 2 - progress) * 1.4 - 0.2;
      light += ((pointer ?? sweep) - light) * 0.08;
      for (const child of ribs.children) {
        if (!(child instanceof HTMLElement) || child.offsetParent === null) continue;
        const position = (child.offsetLeft + child.offsetWidth / 2) / ribs.offsetWidth;
        const glow = Math.exp(-Math.pow((position - light) / 0.16, 2));
        child.style.setProperty("--g", glow.toFixed(3));
      }
      frame = requestAnimationFrame(loop);
    };

    if (!reduced.matches) {
      hero.addEventListener("mousemove", move);
      hero.addEventListener("mouseleave", leave);
      frame = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(frame);
      hero.removeEventListener("mousemove", move);
      hero.removeEventListener("mouseleave", leave);
    };
  }, []);

  return (
    <>
      <div ref={ribsRef} aria-hidden="true" className="ribs pointer-events-none absolute inset-x-0 top-0 h-[45rem]">
        {Array.from({ length: 24 }, (_, i) => {
          const distance = Math.abs((i + 0.5) / 24 - 0.5) * 2;
          const height = Math.round((100 - 52 * Math.pow(distance, 1.5)) * 10) / 10;
          return <span key={i} className="rib" style={{ "--h": `${height}%`, animationDelay: `${Math.round(distance * 12) * 45}ms` } as CSSProperties} />;
        })}
      </div>
      <div aria-hidden="true" className="ribs-glow pointer-events-none absolute inset-x-0 top-0 h-[50rem]" />
    </>
  );
}