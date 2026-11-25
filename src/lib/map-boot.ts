import type * as L from "leaflet";

/** Loads Leaflet, trying again if the file fails to download (slow or flaky connections). */
export async function loadLeaflet(): Promise<typeof L> {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      const mod = (await import("leaflet")).default as typeof L;
      await import("leaflet/dist/leaflet.css");
      return mod;
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 600 * (i + 1))); }
  }
  throw last;
}

const TILES = [
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
];

/**
 * Adds the base tiles and keeps the map healthy: if tiles keep failing it switches to the other tile server,
 * and it re-measures itself when its box changes size, the tab comes back, or the network returns.
 * Returns a function that stops the watchers.
 */
export function hardenMap(m: L.Map, Lf: typeof L, first = 0): () => void {
  let idx = first, errors = 0;
  const make = (i: number) => Lf.tileLayer(TILES[i]!, { maxZoom: 19, attribution: "© OpenStreetMap contributors" });
  let layer = make(idx).addTo(m);
  const onErr = () => {
    if (++errors < 6) return;
    errors = 0; idx = (idx + 1) % TILES.length;
    m.removeLayer(layer); layer = make(idx).addTo(m); layer.on("tileerror", onErr);
  };
  layer.on("tileerror", onErr);
  const fix = () => { m.invalidateSize(); layer.redraw(); };
  const el = m.getContainer();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => m.invalidateSize()) : null;
  ro?.observe(el);
  const vis = () => { if (document.visibilityState === "visible") fix(); };
  document.addEventListener("visibilitychange", vis);
  window.addEventListener("online", fix);
  const t = window.setTimeout(() => m.invalidateSize(), 350);
  return () => { ro?.disconnect(); document.removeEventListener("visibilitychange", vis); window.removeEventListener("online", fix); window.clearTimeout(t); };
}
