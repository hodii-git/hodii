import { hardenMap, loadLeaflet } from "@/lib/map-boot";
import { Loader } from "@/components/loader";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Hand, LocateFixed, MapPin, Move, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { mapPinsQuery } from "@/lib/properties.functions";
import { distanceM, polygonArea, radiusLabel, searchablePolygon, simplifyTo, type LngLat } from "@/lib/geo";
import { RadiusEditor, clampRadius } from "./radius-editor";
import { formatPrice } from "@/lib/format";
import { setHoverPin, useHoverPin } from "@/lib/hover-pin";
import type { SearchParams } from "@/lib/listing-search";
import type * as L from "leaflet";

/** Is the point inside the outline (ray casting)? */
function pointInRing(pt: L.LatLng, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i]!, [yj, xj] = ring[j]!;
    if (yi > pt.lat !== yj > pt.lat && pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

type Mode = "pan" | "pin" | "shape";
type Geo = Pick<SearchParams, "circle" | "polygon">;

/**
 * Map search. Tap or click to drop a centre and pick a radius (or drag out a circle), or draw any shape with a finger or the mouse.
 * Only the listings inside are shown. The shape lives in the address bar, so it can be shared and saved as an alert.
 */
export function SearchMap({ params, onGeo, variant = "default", overlay }: { params: SearchParams; onGeo: (g: Geo) => void; variant?: "default" | "home"; overlay?: React.ReactNode }) {
  const home = variant === "home";
  const homeRef = useRef(home);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const lib = useRef<typeof L | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const layers = useRef<{ pins: L.LayerGroup; shape: L.LayerGroup; draft: L.LayerGroup } | null>(null);
  const [mode, setMode] = useState<Mode>("pan");
  const [ready, setReady] = useState(false);
  // Pointing at the area (or tapping it on a phone) shows its edit bar; "Adjust" adds handles to drag the centre and the edge.
  const [bar, setBar] = useState(false);
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false); editingRef.current = editing;
  const overBar = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBar = () => { if (hideTimer.current) clearTimeout(hideTimer.current); setBar(true); };
  const hideBarSoon = () => { if (hideTimer.current) clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => { if (!overBar.current && !editingRef.current) setBar(false); }, 1800); };
  const modeRef = useRef(mode); modeRef.current = mode;
  const radiusRef = useRef(params.circle?.radiusM ?? 2000); if (params.circle) radiusRef.current = params.circle.radiusM;
  const onGeoRef = useRef(onGeo); onGeoRef.current = onGeo;
  const shapes = useRef<{ circle?: L.Circle; poly?: L.Polygon; polyRing?: [number, number][] }>({});
  const skipFit = useRef(false); // after dragging the area itself, the map must not jump to re-frame it
  const { data, isFetching } = useQuery(mapPinsQuery(params));

  // Build the map once, in the browser only.
  useEffect(() => {
    let dead = false;
    let stop: (() => void) | undefined;
    (async () => {
      const Lf = await loadLeaflet().catch(() => null);
      if (!Lf) return;
      if (dead || !box.current) return;
      lib.current = Lf;
      const m = Lf.map(box.current, { zoomControl: true, attributionControl: true }).setView([-1.2921, 36.8219], 11);
      stop = hardenMap(m, Lf, 0);
      m.zoomControl.setPosition("bottomright");
      // While a pin card is open it sits above the map tools and controls.
      const wrap = box.current.parentElement;
      m.on("popupopen", () => wrap?.classList.add("map-pop-open"));
      m.on("popupclose", () => wrap?.classList.remove("map-pop-open"));
      if (homeRef.current) m.scrollWheelZoom.disable();
      layers.current = { pins: Lf.layerGroup().addTo(m), shape: Lf.layerGroup().addTo(m), draft: Lf.layerGroup().addTo(m) };
      map.current = m;
      attachDrawing(m, Lf);
      setReady(true);
    })();
    return () => { dead = true; stop?.(); map.current?.remove(); map.current = null; };
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
      if (modeRef.current === "pin") Lf.circle(start, { radius: Math.max(500, distanceM({ lat: start.lat, lng: start.lng }, ll)), color: "#2563eb", weight: 2, fillOpacity: 0.12 }).addTo(d);
      else { path.push([ll.lng, ll.lat]); Lf.polyline(path.map((c) => [c[1], c[0]] as [number, number]), { color: "#2563eb", weight: 3 }).addTo(d); }
    });
    const finish = (e: PointerEvent) => {
      if (!active || !start) return;
      active = false; layers.current?.draft.clearLayers();
      const ll = at(e);
      if (modeRef.current === "pin") {
        const dragged = distanceM({ lat: start.lat, lng: start.lng }, ll);
        // A tap uses the chosen radius; a drag sizes the circle by hand.
        const radiusM = dragged < 150 ? radiusRef.current : clampRadius(dragged);
        onGeoRef.current({ circle: { lat: start.lat, lng: start.lng, radiusM } });
        setMode("pan");
      } else {
        const pts = searchablePolygon(simplifyTo(path, 60));
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

  // With a mouse, no tool is needed: point at the edge of the circle to stretch it, or anywhere inside the area to pick it up and move it.
  useEffect(() => {
    const Lf = lib.current, m = map.current; if (!Lf || !m || !ready) return;
    const el = m.getContainer();
    type Hit = "edge" | "inside" | null;
    const hit = (e: L.LeafletMouseEvent): Hit => {
      const { circle, poly } = shapes.current;
      if (circle) {
        const c = circle.getLatLng();
        const R = m.latLngToContainerPoint(c).distanceTo(m.latLngToContainerPoint(Lf.latLng(c.lat, c.lng + circle.getRadius() / (111_320 * Math.cos((c.lat * Math.PI) / 180)))));
        const d = e.containerPoint.distanceTo(m.latLngToContainerPoint(c));
        return Math.abs(d - R) <= 9 ? "edge" : d < R ? "inside" : null;
      }
      if (poly) {
        const ring = shapes.current.polyRing ?? [];
        if (edgeAt(e.containerPoint) >= 0) return "edge";
        return poly.getBounds().contains(e.latlng) && pointInRing(e.latlng, ring) ? "inside" : null;
      }
      return null;
    };
    /** Index of the outline segment under the pointer (within 9 px), or -1. */
    const edgeAt = (pt: L.Point): number => {
      const ring = shapes.current.polyRing ?? [];
      let best = -1, bestD = 9;
      for (let i = 0; i < ring.length; i++) {
        const a = m.latLngToContainerPoint(ring[i]!), b = m.latLngToContainerPoint(ring[(i + 1) % ring.length]!);
        const d = Lf.LineUtil.pointToSegmentDistance(pt, a, b);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    };
    const cursor = (h: Hit) => { el.style.cursor = h === "edge" ? "ew-resize" : h === "inside" ? "grab" : ""; };
    let drag: { kind: "edge" | "move"; from: L.LatLng; ring?: [number, number][]; seg?: number } | null = null;
    const move = (e: L.LeafletMouseEvent) => {
      if (!drag) { if (modeRef.current === "pan" && !editingRef.current) { const h = hit(e); cursor(h); if (h) showBar(); } return; }
      const { circle, poly } = shapes.current;
      if (drag.kind === "edge" && circle) circle.setRadius(Math.max(500, Math.min(100_000, distanceM({ lat: circle.getLatLng().lat, lng: circle.getLatLng().lng }, { lat: e.latlng.lat, lng: e.latlng.lng }))));
      if (drag.kind === "edge" && poly && drag.ring && drag.seg !== undefined) {
        // Pull the outline the way the pointer goes: the two ends of the edge follow fully, their neighbours half way.
        const dLat = e.latlng.lat - drag.from.lat, dLng = e.latlng.lng - drag.from.lng, n = drag.ring.length;
        const sg = drag.seg;
        const w = (k: number) => (k === sg || k === (sg + 1) % n ? 1 : k === (sg + n - 1) % n || k === (sg + 2) % n ? 0.4 : 0);
        drag.ring = drag.ring.map(([la, ln], k) => [la + dLat * w(k), ln + dLng * w(k)] as [number, number]);
        drag.from = e.latlng; poly.setLatLngs(drag.ring);
      }
      if (drag.kind === "move") {
        const dLat = e.latlng.lat - drag.from.lat, dLng = e.latlng.lng - drag.from.lng;
        if (circle) circle.setLatLng([circle.getLatLng().lat + dLat, circle.getLatLng().lng + dLng]);
        drag.from = e.latlng;
        if (poly && drag.ring) { drag.ring = drag.ring.map(([la, ln]) => [la + dLat, ln + dLng] as [number, number]); poly.setLatLngs(drag.ring); }
      }
    };
    const down = (e: L.LeafletMouseEvent) => {
      if (modeRef.current !== "pan" || editingRef.current || (e.originalEvent as MouseEvent).button !== 0 || (e.originalEvent as PointerEvent).pointerType === "touch") return;
      const h = hit(e); if (!h) return;
      m.dragging.disable(); el.style.cursor = h === "edge" ? "ew-resize" : "grabbing";
      drag = { kind: h === "edge" ? "edge" : "move", from: e.latlng, ...(shapes.current.polyRing ? { ring: shapes.current.polyRing, seg: edgeAt(e.containerPoint) } : {}) };
    };
    const up = () => {
      if (!drag) return;
      const { circle, poly } = shapes.current; const d = drag; drag = null; m.dragging.enable(); el.style.cursor = "";
      skipFit.current = true;
      if (circle) { const c = circle.getLatLng(); onGeoRef.current({ circle: { lat: c.lat, lng: c.lng, radiusM: d.kind === "edge" ? clampRadius(circle.getRadius()) : clampRadius(circle.getRadius()) } }); }
      else if (poly && d.ring) onGeoRef.current({ polygon: d.ring.map(([la, ln]) => [ln, la]) });
    };
    m.on("mousemove", move); m.on("mousedown", down); document.addEventListener("mouseup", up);
    return () => { m.off("mousemove", move); m.off("mousedown", down); document.removeEventListener("mouseup", up); el.style.cursor = ""; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Draw the current search area, with drag handles while it is being adjusted.
  useEffect(() => {
    const Lf = lib.current, m = map.current, ls = layers.current; if (!Lf || !m || !ls || !ready) return;
    ls.shape.clearLayers();
    shapes.current = {};
    const style = { color: "#2563eb", weight: 2, fillOpacity: editing ? 0.16 : 0.1 };
    const wire = (layer: L.Path) => { layer.on("mouseover", showBar); layer.on("mouseout", hideBarSoon); layer.on("click", () => { showBar(); hideBarSoon(); }); };
    if (params.circle) {
      const { lat, lng, radiusM } = params.circle;
      const c = Lf.circle([lat, lng], { radius: radiusM, ...style }).addTo(ls.shape); wire(c); shapes.current.circle = c;
      if (skipFit.current) skipFit.current = false;
      else if (!editing) m.fitBounds(c.getBounds(), { padding: [40, 40], animate: false });
      else {
        const handle = (cls: string) => Lf.divIcon({ className: "hodii-handle-wrap", html: `<span class="hodii-handle ${cls}"></span>`, iconSize: [0, 0] });
        const edge = (centre: L.LatLng) => Lf.latLng(centre.lat, centre.lng + radiusM / (111_320 * Math.cos((centre.lat * Math.PI) / 180)));
        const centre = Lf.marker([lat, lng], { draggable: true, icon: handle("centre"), zIndexOffset: 2000 }).addTo(ls.shape);
        const rim = Lf.marker(edge(Lf.latLng(lat, lng)), { draggable: true, icon: handle("rim"), zIndexOffset: 2000 }).addTo(ls.shape);
        centre.on("drag", () => { const p = centre.getLatLng(); c.setLatLng(p); rim.setLatLng(edge(p)); });
        centre.on("dragend", () => { const p = centre.getLatLng(); onGeoRef.current({ circle: { lat: p.lat, lng: p.lng, radiusM } }); });
        rim.on("drag", () => { const p = centre.getLatLng(); c.setRadius(Math.max(500, distanceM({ lat: p.lat, lng: p.lng }, rim.getLatLng()))); });
        rim.on("dragend", () => { const p = centre.getLatLng(); onGeoRef.current({ circle: { lat: p.lat, lng: p.lng, radiusM: clampRadius(distanceM({ lat: p.lat, lng: p.lng }, rim.getLatLng())) } }); });
      }
    } else if (params.polygon) {
      const p = Lf.polygon(params.polygon.map((c) => [c[1]!, c[0]!] as [number, number]), style).addTo(ls.shape); wire(p);
      shapes.current.poly = p; shapes.current.polyRing = params.polygon.map((c) => [c[1]!, c[0]!] as [number, number]);
      if (skipFit.current) skipFit.current = false; else m.fitBounds(p.getBounds(), { padding: [40, 40], animate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.circle, params.polygon, ready, editing]);

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
      const media = document.createElement("span"); media.className = "hodii-pop-media";
      if (p.image) { const img = document.createElement("img"); img.src = p.image; img.alt = ""; img.loading = "lazy"; img.width = 260; img.height = 160; media.append(img); }
      const tag = document.createElement("span"); tag.className = "hodii-pop-price"; tag.textContent = label; media.append(tag);
      a.append(media);
      const body = document.createElement("span"); body.className = "hodii-pop-body";
      const price = document.createElement("strong"); price.textContent = "View listing →"; price.className = "hodii-pop-cta";
      const title = document.createElement("span"); title.className = "hodii-pop-title"; title.textContent = p.title;
      const place = document.createElement("span"); place.className = "hodii-pop-place"; place.textContent = `${p.place}${p.approximate ? (p.place ? " · " : "") + "approximate area" : ""}`;
      body.append(title, place, price); a.append(body);
      mk.bindPopup(a, { className: "hodii-popup", closeButton: false, minWidth: 240, maxWidth: 260, autoPanPadding: [16, 16], offset: [0, -14] });
      // The card opens when the pointer is on the pin and stays while the pointer is on the card, so it can be clicked.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const open = () => { clearTimeout(timer); setHoverPin(p.id); if (!mk.isPopupOpen()) mk.openPopup(); };
      const closeSoon = () => { clearTimeout(timer); timer = setTimeout(() => { setHoverPin(null); mk.closePopup(); }, 260); };
      mk.on("mouseover", open); mk.on("mouseout", closeSoon);
      a.addEventListener("mouseenter", () => clearTimeout(timer)); a.addEventListener("mouseleave", closeSoon);
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
  const redraw = () => { setEditing(false); setBar(false); onGeo({}); setMode(params.polygon ? "shape" : "pin"); };
  const remove = () => { setEditing(false); setBar(false); onGeo({}); };
  const tool = (m: Mode, label: string, icon: React.ReactNode, hint: string) => (
    <button type="button" aria-pressed={mode === m} title={hint} onClick={() => setMode(mode === m ? "pan" : m)} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-semibold transition-all ${mode === m ? (home ? "bg-foreground text-background" : "border border-foreground bg-foreground text-background shadow-sm") : (home ? "glass hover:-translate-y-px" : "border border-border bg-background shadow-sm")}`}>{icon}{label}</button>
  );
  const hasArea = !!(params.circle || params.polygon);
  const chip = home ? "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold hover:bg-muted/70" : "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-bold hover:bg-muted";
  const panel = home ? "glass" : "border border-border bg-background/95 shadow-lg backdrop-blur";

  return (
    <div className={home ? "map-clean glass-lg relative isolate z-0 h-full min-h-[22rem] overflow-hidden rounded-[1.5rem]" : "relative isolate z-0 overflow-hidden rounded-2xl bg-card shadow-[var(--lift-shadow)]"}>
      <div ref={box} role="application" aria-label="Map of listings" className={home ? "!absolute inset-0" : "h-[52dvh] min-h-80 lg:h-[34dvh] lg:min-h-56 w-full"} />
      {overlay}
      <div className="absolute inset-x-3 top-3 z-[1000] flex flex-wrap justify-center gap-2" role="toolbar" aria-label="Map search tools">
        {tool("pan", "Move map", <Hand className="size-4" aria-hidden />, "Pan and zoom")}
        {tool("pin", "Drop pin", <MapPin className="size-4" aria-hidden />, "Tap the map to place a centre, or press and drag to size a circle")}
        {tool("shape", "Draw area", <Pencil className="size-4" aria-hidden />, "Draw around the area with your finger or mouse")}
        <button type="button" onClick={locate} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.8125rem] font-semibold ${home ? "glass hover:-translate-y-px transition-all" : "border border-border bg-background font-bold shadow-sm"}`}><LocateFixed className="size-4" aria-hidden />My location</button>
      </div>
      {hasArea && bar && (
        <div onPointerEnter={() => { overBar.current = true; showBar(); }} onPointerLeave={() => { overBar.current = false; hideBarSoon(); }} className={`absolute left-1/2 top-16 z-[1000] flex -translate-x-1/2 items-center gap-1.5 rounded-full p-1.5 ${panel}`} role="toolbar" aria-label="Edit the search area">
          {params.circle && (editing
            ? <button type="button" onClick={() => { setEditing(false); setBar(false); }} className={chip}><Check className="size-3.5" aria-hidden />Done</button>
            : <button type="button" onClick={() => setEditing(true)} className={chip}><Move className="size-3.5" aria-hidden />Adjust</button>)}
          <button type="button" onClick={redraw} className={chip}><RotateCcw className="size-3.5" aria-hidden />Redraw</button>
          <button type="button" onClick={remove} className={`${chip} text-destructive`}><Trash2 className="size-3.5" aria-hidden />Remove</button>
          <button type="button" onClick={() => { setEditing(false); setBar(false); }} aria-label="Close" className="close-circle"><X className="size-4" aria-hidden /></button>
        </div>
      )}
      <div className="absolute bottom-3 left-3 right-16 z-[1000] flex flex-wrap items-end justify-between gap-2">
        <div className={`max-w-full rounded-2xl p-2.5 ${panel}`}>
          {params.circle ? (
            <div className="space-y-2">
              <p className="text-xs font-bold">Within {radiusLabel(params.circle.radiusM)} of your pin</p>
              <RadiusEditor radiusM={params.circle.radiusM} onChange={setRadius} compact />
            </div>
          ) : params.polygon ? <p className="text-xs font-bold">Inside the area you drew</p>
            : <p className="text-xs text-muted-foreground" aria-live="polite">{mode === "pin" ? "Tap the map to place a pin, or press and drag to size a circle." : mode === "shape" ? "Press and draw around the area, then let go."         : "Drop a pin or draw an area, then point at its edge to resize it or inside it to move it."}</p>}
        </div>
        <p className={`rounded-full px-3 py-1.5 text-xs font-bold ${panel}`} aria-live="polite">
          {data ? `${data.total.toLocaleString("en-KE")} listing${data.total === 1 ? "" : "s"}${data.total > data.pins.length ? ` · ${data.pins.length} on map` : ""}` : <Loader size="xs" />}
        </p>
      </div>
      {data && !isFetching && data.pins.length === 0 && ready && <p className="absolute inset-x-0 top-1/2 z-[999] mx-auto w-fit max-w-[80%] -translate-y-1/2 rounded-full border border-border bg-background px-4 py-2 text-center text-sm shadow-lg">{data.total === 0 ? "No listings in this area." : "These listings have no map pin yet."} <Link to="/properties" className="font-bold underline">Clear everything</Link></p>}
    </div>
  );
}
