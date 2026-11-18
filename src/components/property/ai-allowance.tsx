import { useEffect, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { getAiStatus } from "@/lib/ai-search.functions";
import { formatCountdown } from "@/lib/ai-quota";

export const aiStatusQuery = queryOptions({ queryKey: ["ai", "status"], queryFn: () => getAiStatus(), staleTime: 30_000 });

/** Re-renders every second while a target time is in the future. */
export function useCountdown(iso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const target = iso ? new Date(iso).getTime() : null;
  useEffect(() => {
    if (!target || target <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return { left: null as number | null, text: null as string | null };
  const left = Math.max(0, target - now);
  return { left, text: formatCountdown(left) };
}

const WHO = { guest: "Visitor", user: "Your account", agency: "Agency account", premium: "Premium agency" } as const;

/** Profile card: how many AI searches are left and a ticking timer until they come back. */
export function AiAllowanceCard() {
  const { data, refetch } = useQuery(aiStatusQuery);
  const cd = useCountdown(data?.resetsAt);
  useEffect(() => { if (cd.left === 0) void refetch(); }, [cd.left, refetch]);
  if (!data || !data.enabled) return null;
  const spent = data.remaining === 0 && cd.left !== null && cd.left > 0;
  return (
    <section className="glass mt-6 rounded-[2rem] p-6" aria-label="AI search allowance">
      <h2 className="flex items-center gap-2 text-xl font-extrabold"><Sparkles className="h-5 w-5" aria-hidden /> AI search</h2>
      <p className="mt-1 text-sm text-muted-foreground">{WHO[data.tier]}: {data.limit} AI searches every {data.windowHours >= 24 && data.windowHours % 24 === 0 ? `${data.windowHours / 24} day${data.windowHours === 24 ? "" : "s"}` : `${data.windowHours} hours`}. Normal searching is always free and unlimited.</p>
      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div><p className="text-3xl font-extrabold">{data.remaining}<span className="text-base font-semibold text-muted-foreground"> / {data.limit}</span></p><p className="text-xs font-semibold text-muted-foreground">left right now</p></div>
        {cd.text && data.used > 0 && (
          <div><p className="font-mono text-3xl font-extrabold tabular-nums" aria-live="off">{cd.text}</p><p className="text-xs font-semibold text-muted-foreground">{spent ? "until your searches come back" : "until your counter restarts"}</p></div>
        )}
      </div>
    </section>
  );
}
