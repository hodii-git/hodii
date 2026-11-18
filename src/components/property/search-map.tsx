import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Circle, Hand, LocateFixed, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { mapPinsQuery } from "@/lib/properties.functions";
import { RADIUS_PRESETS, distanceM, polygonArea, radiusLabel, simplifyTo, type LngLat } from "@/lib/geo";
import { formatPrice } from "@/lib/format";
import { setHoverPin, useHoverPin } from "@/lib/hover-pin";
import type { SearchParams } from "@/lib/listing-search";
import type * as L from "leaflet";

type Mode = "pan" | "circle" | "shape";
type Geo = Pick<SearchParams, "circle" | "polygon">;

/**
 * Map search. Tap or click to drop a centre and pick a radius (or drag out a circle), or draw any shape with a finger or the mouse.
 * Only the listings inside are shown. The shape lives in the address bar, so it can be shared and saved as an alert.
 */
export function SearchMap({ params, onGeo }: { params: SearchParams; onGeo: (g: Geo) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const lib = useRef<typeof L | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const layers = useRef<{ pins: L.LayerGroup; shape: L.LayerGroup; draft: L.LayerGroup } | null>(null);
  const [mode, setMode] = useState<Mode>("pan");
  const [ready, setReady] = useState(false);
  const modeRef = useRef(mode); modeRef.current = mode;
  const radiusRef = useRef(params.circle?.radiusM ?? 2000); if (params.circle) radiusRef.current = params.circle.radiusM;
  const onGeoRef = useRef(onGeo); onGeoRef.current = onGeo;
  const { data } = useQuery(mapPinsQuery(params));

  // Build the map once, in the browser only.
  useEffect(() => {
    let dead = false;
    (async () => {
      const Lf = (await import("leaflet")).default as typeof L;
      await import("leaflet/dist/leaflet.css");
      if (dead || !box.current) return;
      lib.current = Lf;
      const m = Lf.map(box.current, { zoomControl: true, attributionControl: true }).setView([-1.2921, 36.8219], 11);
      Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(m);
      layers.current = { pins: Lf.layerGroup().addTo(m), shape: Lf.layerGroup().addTo(m), draft: Lf.layerGroup().addTo(m) };
      map.current = m;
      attachDrawing(m, Lf);
      setReady(true);
    })();
    return () => { dead = true; map.current?.remove(); map.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function attachDrawing(m: L.Map, Lf: typeof L) {
    const el = m.getContainer();
    let start: L.LatLng | null = null, path: LngLat[] = [], active = false;
    const at = (e: PointerEvent) => m.mouseEventToLatLng(e);
    el.addEventListener("pointerdown", (e) => {
      if (modeRef.current === "pan" || (e.target as HTMLElement).closest(".leaflet-control, .leaflet-popup")) return;
      active = true; el.setPointerCapture(e.pointerId); e.preventDefault();
      const ll = at(e); start = ll; path = [[ll.lng, ll.lat]];
      layers.current?.draft.clearLayers();
    });
    el.addEventListener("pointermove", (e) => {
      if (!active || !start) return;
      const ll = at(e), d = layers.current!.draft;
      d.clearLayers();
      if (modeRef.current === "circle") Lf.circle(start, { radius: Math.max(500, distanceM({ lat: start.lat, lng: start.lng }, ll)), color: "#e11d48", weight: 2, fillOpacity: 0.12 }).addTo(d);
      else { path.push([ll.lng, ll.lat]); Lf.polyline(path.map((c) => [c[1], c[0]] as [number, number]), { color: "#e11d48", weight: 3 }).addTo(d); }
    });
    const finish = (e: PointerEvent) => {
      if (!active || !start) return;
      active = false; layers.current?.draft.clearLayers();
      const ll = at(e);
      if (modeRef.current === "circle") {
        const dragged = distanceM({ lat: start.lat, lng: start.lng }, ll);
        // A tap uses the chosen radius; a drag sizes the circle by hand.
        const radiusM = dragged < 150 ? radiusRef.current : Math.min(100_000, Math.max(500, Math.round(dragged / 100) * 100));
        onGeoRef.current({ circle: { lat: start.lat, lng: start.lng, radiusM } });
        setMode("pan");
      } else {
        const pts = simplifyTo(path, 60);
        if (pts.length < 3 || polygonArea(pts) < 1e-8) toast.error("Draw a closed area: keep your finger or mouse down and go around the place you want.");
        else { onGeoRef.current({ polygon: pts }); setMode("pan"); }
      }
      start = null; path = [];
    };
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", () => { active = false; layers.current?.draft.clearLayers(); });
  }

  // Dragging the map must be off while drawing, or the finger would pan instead.
  useEffect(() => {
    const m = map.current; if (!m) return;
    const drawing = mode !== "pan";
    if (drawing) { m.dragging.disable(); m.touchZoom.disable(); m.doubleClickZoom.disable(); m.boxZoom.disable(); } else { m.dragging.enable(); m.touchZoom.enable(); m.doubleClickZoom.enable(); m.boxZoom.enable(); }
    m.getContainer().style.cursor = drawing ? "crosshair" : "";
    m.getContainer().style.touchAction = drawing ? "none" : "";
  }, [mode, ready]);

  // Draw the current search area and the pins.
  useEffect(() => {
    const Lf = lib.current, m = map.current, ls = layers.current; if (!Lf || !m || !ls || !ready) return;
    ls.shape.clearLayers();
    const style = { color: "#e11d48", weight: 2, fillOpacity: 0.1 };
    if (params.circle) { const c = Lf.circle([params.circle.lat, params.circle.lng], { radius: params.circle.radiusM, ...style }).addTo(ls.shape); m.fitBounds(c.getBounds(), { padding: [24, 24], animate: false }); }
    else if (params.polygon) { const p = Lf.polygon(params.polygon.map((c) => [c[1]!, c[0]!] as [number, number]), style).addTo(ls.shape); m.fitBounds(p.getBounds(), { padding: [24, 24], animate: false }); }
  }, [params.circle, params.polygon, ready]);

  useEffect(() => {
    const Lf = lib.current, m = map.current, ls = layers.current; if (!Lf || !m || !ls || !ready || !data) return;
    ls.pins.clearLayers();
    markers.current.clear();
    for (const p of data.pins) {
      const label = formatPrice(p.price, { compact: true });
      const safe = label.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      const icon = Lf.divIcon({ className: "hodii-pin-wrap", html: `<span class="hodii-pin">${safe}</span>`, iconSize: [0, 0] });
      const mk = Lf.marker([p.lat, p.lng], { icon, riseOnHover: true }).addTo(ls.pins);
      markers.current.set(p.id, mk);
      // A clean card: photo, price, title, place. Built with DOM calls so listing text can never become markup.
      const a = document.createElement("a"); a.href = `/property/${p.slug}`; a.className = "hodii-pop";
      if (p.image) { const img = document.createElement("img"); img.src = p.image; img.alt = ""; img.loading = "lazy"; img.width = 240; img.height = 150; a.append(img); }
      const body = document.createElement("span"); body.className = "hodii-pop-body";
      const price = document.createElement("strong"); price.textContent = label;
      const title = document.createElement("span"); title.className = "hodii-pop-title"; title.textContent = p.title;
      const place = document.createElement("span"); place.className = "hodii-pop-place"; place.textContent = `${p.place}${p.approximate ? (p.place ? " · " : "") + "approximate area" : ""}`;
      body.append(price, title, place); a.append(body);
      mk.bindPopup(a, { className: "hodii-popup", closeButton: false, minWidth: 220, maxWidth: 240, autoPanPadding: [16, 16] });
      mk.on("mouseover", () => setHoverPin(p.id)); mk.on("mouseout", () => setHoverPin(null));
    }
    if (!params.circle && !params.polygon && data.pins.length) m.fitBounds(Lf.latLngBounds(data.pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [32, 32], maxZoom: 15, animate: false });
  }, [data, ready, params.circle, params.polygon]);

  // Pointing at a card lights its pin, and pointing at a pin lights its card's id for anything listening.
  const hovered = useHoverPin();
  useEffect(() => {
    markers.current.forEach((mk, id) => { const el = mk.getElement()?.firstElementChild; if (el) el.classList.toggle("on", id === hovered); mk.setZIndexOffset(id === hovered ? 1000 : 0); });
  }, [hovered, data, ready]);

  const locate = () => {
    if (!navigator.geolocation) { toast.error("Your browser cannot share your location"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => onGeo({ circle: { lat: pos.coords.latitude, lng: pos.coords.longitude, radiusM: radiusRef.current } }),
      () => toast.error("We could not get your location. Allow location access, or tap the map to choose a centre."), { enableHighAccuracy: true, timeout: 10_000 });
  };
  const setRadius = (r: number) => { radiusRef.current = r; if (params.circle) onGeo({ circle: { ...params.circle, radiusM: r } }); };
  const tool = (m: Mode, label: string, icon: React.ReactNode, hint: string) => (
    <button type="button" aria-pressed={mode === m} title={hint} onClick={() => setMode(mode === m ? "pan" : m)} className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-bold ${mode === m ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>{icon}{label}</button>
  );
  const hasArea = !!(params.circle || params.polygon);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Map search tools">
        {tool("pan", "Move map", <Hand className="size-4" aria-hidden />, "Pan and zoom")}
        {tool("circle", "Circle", <Circle className="size-4" aria-hidden />, "Tap to set a centre, or drag out a circle")}
        {tool("shape", "Draw area", <Pencil className="size-4" aria-hidden />, "Draw around the area with your finger or mouse")}
        <button type="button" onClick={locate} className="inline-flex h-10 items-center gap-2 rounded-full border border-input bg-background px-4 text-sm font-bold"><LocateFixed className="size-4" aria-hidden />Near me</button>
        {hasArea && <button type="button" onClick={() => onGeo({})} className="inline-flex h-10 items-center gap-2 rounded-full border border-input bg-background px-4 text-sm font-bold"><X className="size-4" aria-hidden />Clear area</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Search radius">
        <span className="text-muted-foreground">Radius</span>
        {RADIUS_PRESETS.map((r) => <button key={r} type="button" aria-pressed={radiusRef.current === r && !!params.circle} onClick={() => setRadius(r)} className={`h-8 rounded-full border px-3 text-xs font-bold ${params.circle?.radiusM === r ? "border-primary bg-primary/10" : "border-input"}`}>{radiusLabel(r)}</button>)}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {mode === "circle" ? "Tap the map to set the centre, or press and drag to size the circle." : mode === "shape" ? "Press and draw around the area you want, then let go." : hasArea ? "Showing only listings inside your area." : "Choose Circle or Draw area to search inside a part of the map."}
        {data && ` ${data.total.toLocaleString("en-KE")} listing${data.total === 1 ? "" : "s"}${data.total > data.pins.length ? `, showing ${data.pins.length} on the map` : ""}.`}
      </p>
      <div ref={box} role="application" aria-label="Map of listings" className="h-[60vh] min-h-80 w-full overflow-hidden rounded-2xl border border-border" />
      {data && data.pins.length === 0 && ready && <p className="text-sm text-muted-foreground">No listings with a map pin match here. <Link to="/properties" className="font-bold underline">Clear everything</Link></p>}
    </div>
  );
}
