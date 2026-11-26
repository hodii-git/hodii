import { useEffect, useRef } from "react";
import { hardenMap, loadLeaflet } from "@/lib/map-boot";

/** Theme pin: same red as the active tab in the bottom bar. */
export const THEME_PIN = "url(#pin-grad)";

/**
 * Small map for a listing. It always shows the pin at the listing's point, even when the exact address is hidden
 * (then the point is the area the agent chose to show). The pin wears the theme colour.
 */
export function ListingMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let dead = false;
    let stop: (() => void) | undefined;
    let remove: (() => void) | undefined;
    (async () => {
      const Lf = await loadLeaflet().catch(() => null);
      if (!Lf || dead || !box.current) return;
      const m = Lf.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, dragging: !Lf.Browser.mobile }).setView([lat, lng], 15);
      stop = hardenMap(m, Lf, 0);
      m.zoomControl.setPosition("bottomright");
      const icon = Lf.divIcon({
        className: "listing-pin",
        iconSize: [40, 48],
        iconAnchor: [20, 46],
        html: `<svg viewBox="0 0 40 48" width="40" height="48" aria-hidden="true"><defs><linearGradient id="pin-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fd267a"/><stop offset="1" stop-color="#ff6036"/></linearGradient></defs><ellipse cx="20" cy="44.5" rx="8" ry="2.6" fill="rgba(0,0,0,.28)"/><path fill="${THEME_PIN}" stroke="#fff" stroke-width="2" d="M20 2C11.2 2 4.2 9 4.2 17.8 4.2 29.6 20 43 20 43s15.8-13.4 15.8-25.2C35.8 9 28.8 2 20 2Z"/><circle cx="20" cy="17.8" r="5.6" fill="#fff"/></svg>`,
      });
      Lf.marker([lat, lng], { icon, keyboard: false, title: label }).addTo(m);
      remove = () => m.remove();
    })();
    return () => { dead = true; stop?.(); remove?.(); };
  }, [lat, lng, label]);
  return <div ref={box} role="img" aria-label={`Map of ${label}`} className="h-72 w-full overflow-hidden rounded-2xl border border-border" />;
}
