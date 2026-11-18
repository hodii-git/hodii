import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { getLiveStamp } from "@/lib/notifications.functions";

/** Public data that changes when listings change. Loader-backed pages are cleared and reloaded; others simply refetch. */
const LOADER_KEYS = [["property-home"], ["listings"], ["property"], ["agency-page"]] as const;
const OBSERVED_KEYS = [["home-nearby"], ["saved", "list"], ["saved", "state"]] as const;
const EVERY_MS = 15_000;

/**
 * Keeps what people see in step with the database without a manual refresh. Every 15 seconds, while the page is visible, it asks a tiny
 * public question (cached by the edge for a few seconds, so many visitors cost the database one lookup). When the answer changes,
 * the visible lists reload: new listings, price changes, takedowns.
 */
export function LiveUpdates() {
  const qc = useQueryClient();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const skip = path.startsWith("/admin");
  const { data } = useQuery({ queryKey: ["live-stamp"], queryFn: () => getLiveStamp(), enabled: !skip, refetchInterval: EVERY_MS, refetchOnWindowFocus: true, staleTime: 5_000, retry: 0 });
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const stamp = data?.stamp;
    if (!stamp || stamp === "unavailable") return;
    if (seen.current === null) { seen.current = stamp; return; }
    if (seen.current === stamp) return;
    seen.current = stamp;
    for (const key of LOADER_KEYS) qc.removeQueries({ queryKey: [...key] });
    for (const key of OBSERVED_KEYS) qc.invalidateQueries({ queryKey: [...key] });
    router.invalidate();
  }, [data?.stamp, qc, router]);
  return null;
}
