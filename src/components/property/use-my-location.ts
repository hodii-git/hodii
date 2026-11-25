import { toast } from "sonner";

/** Asks the browser where the person is and hands back a search circle around it. */
export function locateMe(radiusM: number, done: (c: { lat: number; lng: number; radiusM: number }) => void) {
  if (!navigator.geolocation) { toast.error("Your browser cannot share your location"); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => done({ lat: pos.coords.latitude, lng: pos.coords.longitude, radiusM }),
    () => toast.error("We could not get your location. Allow location access and try again."),
    { enableHighAccuracy: true, timeout: 10_000 },
  );
}
