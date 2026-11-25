import { useEffect, useRef, useState, type ReactNode } from "react";

/** A small label that appears over a toolbar button for a few seconds when it is tapped, hovered or long-pressed. */
export function useToolHint(text: string) {
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  const show = (ms = 2200) => { setOn(true); clearTimeout(t.current); t.current = setTimeout(() => setOn(false), ms); };
  const hide = () => { clearTimeout(t.current); setOn(false); };
  const bubble: ReactNode = on ? <span role="status" className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-lg">{text}</span> : null;
  return { show, hide, bubble, handlers: { onMouseEnter: () => show(2600), onMouseLeave: hide, onPointerDown: (e: React.PointerEvent) => { if (e.pointerType !== "mouse") show(); } } };
}
