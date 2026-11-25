import { useEffect, useState } from "react";
import { greetingFor } from "@/lib/greeting";

/** Server and first paint say "Hello" so they always match; the real greeting appears on the person's device and refreshes each minute. */
export function useGreeting() {
  const [g, setG] = useState("Hello");
  useEffect(() => { const tick = () => setG(greetingFor(new Date().getHours())); tick(); const t = setInterval(tick, 60_000); return () => clearInterval(t); }, []);
  return g;
}
