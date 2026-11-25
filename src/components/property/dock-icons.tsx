import { useId } from "react";

/** The action-dock glyphs, shared by the dock and the contact buttons so they always look the same. */
const BLUE: [string, string][] = [["0", "#14c4ff"], ["0.5", "#0aabfc"], ["1", "#0a78ee"]];
const GREEN: [string, string][] = [["0", "#9be33a"], ["0.5", "#74cf38"], ["1", "#2bb55a"]];
export const BLUE_GRADIENT = "linear-gradient(180deg, #14c4ff 0%, #0aabfc 50%, #0a78ee 100%)";
/** Same blues, running left to right (used on the wide buttons). */
export const BLUE_GRADIENT_H = "linear-gradient(90deg, #14c4ff 0%, #0aabfc 50%, #0a78ee 100%)";

function Glyph({ className, stops, children }: { className?: string; stops: [string, string][]; children: (fill: string) => React.ReactNode }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">{stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}</linearGradient></defs>
      {children(`url(#${id})`)}
    </svg>
  );
}

export function PhoneGlyph({ className = "size-6" }: { className?: string }) {
  return <Glyph className={className} stops={BLUE}>{(f) => <path fill={f} d="M9.6 3.4c.9-.3 1.9.1 2.4.9l2.6 4.3c.5.8.4 1.9-.3 2.6l-2 2c1.4 2.9 3.6 5.1 6.5 6.5l2-2c.7-.7 1.8-.8 2.6-.3l4.3 2.6c.8.5 1.2 1.5.9 2.4l-.8 2.6c-.5 1.6-2 2.7-3.7 2.6C13.6 27 5 18.4 4.4 7.9c-.1-1.7 1-3.2 2.6-3.7Z" />}</Glyph>;
}

export function WhatsAppGlyph({ className = "size-7" }: { className?: string }) {
  return (
    <Glyph className={className} stops={GREEN}>
      {(f) => (<>
        <path fill="none" stroke={f} strokeWidth="2.6" strokeLinejoin="round" d="M16 3.5A12.5 12.5 0 0 0 5.2 22.3L3.6 28.4l6.3-1.6A12.5 12.5 0 1 0 16 3.5Z" />
        <path fill={f} d="M11.6 9.6c.3-.1.7-.1 1 0 .3.1.5.6.7 1l.9 2.1c.1.3.1.6-.1.9l-.8 1c-.2.2-.2.5 0 .8a9.6 9.6 0 0 0 4.4 3.9c.3.1.6.1.8-.1l1-1.2c.2-.3.6-.3.9-.2l2.3 1.1c.4.2.6.5.5.9-.1 1.3-1.3 2.4-2.7 2.5-1 .1-2.4-.1-4.6-1.2a14 14 0 0 1-5.5-5.5c-1-1.9-.9-3.3-.6-4.2.3-.9 1-1.6 1.8-1.8Z" />
      </>)}
    </Glyph>
  );
}

/** The same paper-plane as SendGlyph, but one flat colour (currentColor) with the fold cut out, for use inside coloured buttons. */
export function SendMark({ className = "size-5" }: { className?: string }) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs><mask id={id}><rect width="32" height="32" fill="#fff" /><path fill="#000" d="m11.4 17.4 13.2-9.7-10.4 11.2-.8 4.3z" /></mask></defs>
      <path fill="currentColor" mask={`url(#${id})`} d="M28.6 3.6 2.9 13.4c-1 .4-.9 1.8.1 2.1l7.2 2.2 2.3 7.5c.3 1 1.6 1.2 2.2.4l3.4-4.2 6.7 4.9c.8.6 1.9.1 2.1-.8l3.6-20.6c.2-1-.8-1.7-1.9-1.3Z" />
    </svg>
  );
}

export function SendGlyph({ className = "size-6", cutout = "#1c1c1e" }: { className?: string; cutout?: string }) {
  return (
    <Glyph className={className} stops={BLUE}>
      {(f) => (<>
        <path fill={f} d="M28.6 3.6 2.9 13.4c-1 .4-.9 1.8.1 2.1l7.2 2.2 2.3 7.5c.3 1 1.6 1.2 2.2.4l3.4-4.2 6.7 4.9c.8.6 1.9.1 2.1-.8l3.6-20.6c.2-1-.8-1.7-1.9-1.3Z" />
        <path fill={cutout} d="m11.4 17.4 13.2-9.7-10.4 11.2-.8 4.3z" />
      </>)}
    </Glyph>
  );
}
