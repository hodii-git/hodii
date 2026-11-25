import { useEffect, useRef, useState, type ReactNode } from "react";

/** Long text stops at a set height with a soft fade and a small Show more / Show less button (only when the text is actually longer). */
export function ShowMore({ children, max = "16rem" }: { children: ReactNode; max?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const check = () => setLong(el.scrollHeight > el.clientHeight + 4 || open);
    check(); const ro = new ResizeObserver(check); ro.observe(el); return () => ro.disconnect();
  }, [open, children]);
  return (
    <div>
      <div ref={box} className="relative overflow-hidden transition-[max-height] duration-500" style={{ maxHeight: open ? "200rem" : max }}>
        {children}
        {long && !open && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--ld-surface,var(--card))] to-transparent" />}
      </div>
      {long && <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 text-sm font-bold underline underline-offset-4">{open ? "Show less" : "Show more"}</button>}
    </div>
  );
}
