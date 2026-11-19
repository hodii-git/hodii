import { useEffect, useState } from "react";

const PLACES = ["Kenya", "Nairobi", "Westlands", "Kitisuru", "Kilimani", "Karen"];
const KINDS = ["place", "home", "apartment", "villa", "townhouse", "bedsitter"];

/** "Find your next place in Kenya", with the two key words changing in turn while nobody is searching. Screen readers and search engines get the plain sentence. */
export function RotatingHeadline() {
  const [tick, setTick] = useState(0);
  const [show, setShow] = useState(true);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setShow(false);
      setTimeout(() => { setTick((t) => t + 1); setShow(true); }, 280);
    }, 2600);
    return () => clearInterval(id);
  }, []);
  // The kind changes on one beat and the place on the next, so only one word moves at a time.
  const kind = KINDS[Math.floor((tick + 1) / 2) % KINDS.length]!, place = PLACES[Math.floor(tick / 2 + (tick % 2 ? 0 : 0)) % PLACES.length]!;
  const word = (w: string, mine: boolean) => <span aria-hidden className={`inline-block bg-gradient-to-r from-blue-500 to-blue-700 bg-clip-text text-transparent transition-all duration-300 ${mine && !show ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}>{w}</span>;
  return (
    <>
      <span className="sr-only">Find your next place in Kenya</span>
      <span aria-hidden>Find your next {word(kind, tick % 2 === 1)} in {word(place, tick % 2 === 0)}</span>
    </>
  );
}
