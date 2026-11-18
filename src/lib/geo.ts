/** Small map helpers. Pure, so they are tested without a browser. Points are [longitude, latitude]. */
export type LngLat = [number, number];

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const sqSegDist = (p: LngLat, a: LngLat, b: LngLat) => {
  let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
};

/** Douglas–Peucker: keeps the shape of a finger-drawn line with far fewer points. */
export function simplify(points: LngLat[], tolerance: number): LngLat[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  const tol = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let max = 0, idx = -1;
    for (let i = first + 1; i < last; i++) { const d = sqSegDist(points[i]!, points[first]!, points[last]!); if (d > max) { max = d; idx = i; } }
    if (idx !== -1 && max > tol) { keep[idx] = 1; stack.push([first, idx], [idx, last]); }
  }
  return points.filter((_, i) => keep[i]);
}

/** Reduces a drawn line to at most `max` points, widening the tolerance until it fits. */
export function simplifyTo(points: LngLat[], max: number): LngLat[] {
  let tol = 0.00002, out = simplify(points, tol);
  while (out.length > max && tol < 1) { tol *= 1.6; out = simplify(points, tol); }
  return out.length > max ? out.slice(0, max) : out;
}

/** Drawn shapes with self-crossings or no area cannot be searched. */
export function polygonArea(points: LngLat[]) {
  let s = 0;
  for (let i = 0; i < points.length; i++) { const [x1, y1] = points[i]!, [x2, y2] = points[(i + 1) % points.length]!; s += x1 * y2 - x2 * y1; }
  return Math.abs(s) / 2;
}

export const RADIUS_PRESETS = [500, 1000, 2000, 3000, 5000, 10000] as const;
export const radiusLabel = (m: number) => (m < 1000 ? `${m} m` : `${m / 1000} km`);

export const directionsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
export const osmDirectionsUrl = (lat: number, lng: number) => `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`;
