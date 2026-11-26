import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { hardenMap, loadLeaflet } from "@/lib/map-boot";
import { mapPinsQuery } from "@/lib/properties.functions";
import { compactNumber } from "@/lib/format";
import type { SearchParams } from "@/lib/listing-search";
import type * as L from "leaflet";

const PARAMS = {} as SearchParams;

/** Landing-page map: light tiles, navy price pins for current listings, and a List / Map switch that opens the full search. */
export function HomeMap() {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const lib = useRef<typeof L | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { data } = useQuery(mapPinsQuery(PARAMS));

  useEffect(() => {
    let dead = false;
    let stop: (() => void) | undefined;
    (async () => {
      const Lf = await loadLeaflet().catch(() => null);
      if (!Lf) return;
      if (dead || !box.current) return;
      lib.current = Lf;
      const m = Lf.map(box.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([-1.2921, 36.8219], 11);
      stop = hardenMap(m, Lf, 1);
      layer.current = Lf.layerGroup().addTo(m);
      map.current = m;
      setReady(true);
    })();
    return () => { dead = true; stop?.(); map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const Lf = lib.current, m = map.current, g = layer.current;
    if (!Lf || !m || !g || !data) return;
    g.clearLayers();
    const pts: [number, number][] = [];
    for (const p of data.pins.slice(0, 40)) {
      const label = p.price ? `${compactNumber(p.price.amount)}${p.price.period === "month" ? "/mo" : ""}` : "View";
      const icon = Lf.divIcon({ className: "", html: `<span class="price-pin">${label}</span>`, iconSize: [0, 0] });
      Lf.marker([p.lat, p.lng], { icon, title: p.title }).on("click", () => navigate({ to: "/property/$slug", params: { slug: p.slug } })).addTo(g);
      pts.push([p.lat, p.lng]);
    }
    if (pts.length > 1) m.fitBounds(pts, { padding: [40, 40], maxZoom: 13 });
    else if (pts.length === 1) m.setView(pts[0]!, 13);
  }, [data, navigate, ready]);

  return (
    <div className="home-map surface relative h-full min-h-[22rem] overflow-hidden rounded-[1.5rem]">
      <div ref={box} className="!absolute inset-0" aria-label="Map of listings" role="region" />
      <div className="seg-pill absolute right-3 top-3 z-[500]">
        <Link to="/properties" className="seg">List</Link>
        <Link to="/properties" search={{ view: "map" }} className="seg is-on">Map</Link>
      </div>
    </div>
  );
}
