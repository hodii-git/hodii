import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** A slim pill at the top while the device has no connection. The page keeps its look; this only says why things may not update. */
export function OfflineBanner() {
  const [off, setOff] = useState(false);
  useEffect(() => {
    const f = () => setOff(!navigator.onLine);
    f(); window.addEventListener("online", f); window.addEventListener("offline", f);
    return () => { window.removeEventListener("online", f); window.removeEventListener("offline", f); };
  }, []);
  if (!off) return null;
  return (
    <div role="status" className="glass-lux fixed left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-[120] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
      <WifiOff className="size-4" aria-hidden /> You're offline. Showing what was saved.
    </div>
  );
}
