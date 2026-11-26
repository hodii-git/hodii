import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/** A thin bar at the very top while any page is loading, on every route. Appears only if loading lasts more than a moment, so quick moves stay calm. */
export function PageLoader() {
  const loading = useRouterState({ select: (s) => s.isLoading || s.status === "pending" });
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!loading) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), 120);
    return () => clearTimeout(t);
  }, [loading]);
  if (!show) return null;
  return (
    <div role="progressbar" aria-label="Loading page" aria-busy="true" data-floating className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-1 overflow-hidden bg-transparent">
      <div className="h-full w-1/3 animate-[pageload_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
    </div>
  );
}
