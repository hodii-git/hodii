import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getTourProgress, saveTourProgress } from "@/lib/tour.functions";
import { TOURS, TOUR_EVENT, TOUR_TITLES, back, dismiss, finish, load, next, pause, resume, save, shouldPrompt, snooze, start, tourForPath, type TourId, type TourState } from "@/lib/tour";

type Box = { top: number; left: number; width: number; height: number } | null;
const PAD = 6;

export function TourRunner() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const who = user?.id ?? "guest";
  const id = tourForPath(path, !!user);
  const [state, setState] = useState<TourState | null>(null);
  const [forced, setForced] = useState<TourId | null>(null);
  // Moving to another page ends a restarted tour; that page has its own.
  useEffect(() => { setForced(null); }, [path]);
  const active = forced ?? id;
  const [box, setBox] = useState<Box>(null);

  const update = useCallback((s: TourState) => {
    if (active) { save(active, who, s); if (user) void saveTourProgress({ data: { tour: active, status: s.status, step: s.step, until: s.until, snoozes: s.snoozes } }).catch(() => {}); }
    setState(s);
  }, [active, who, user]);

  useEffect(() => {
    setState(active ? load(active, who) : null);
    if (!active || !user) return;
    // Signed in: what we saved on the server follows the person to any device and wins over this browser's copy.
    let off = false;
    void getTourProgress({ data: { tour: active } }).then((r) => {
      if (off) return;
      if (r) { const s = { ...load(active, who), ...r } as TourState; save(active, who, s); setState(s); }
    }).catch(() => {});
    return () => { off = true; };
  }, [active, who, user]);
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<TourId | "here">).detail; const t = d === "here" ? tourForPath(window.location.pathname, !!user) : d; if (!t) return; setForced(t); const s = start({ ...load(t, who), status: "new", step: 0 }); save(t, who, s); setState(s); };
    window.addEventListener(TOUR_EVENT, on);
    return () => window.removeEventListener(TOUR_EVENT, on);
  }, [who, user]);

  const steps = active ? TOURS[active] : [];
  const step = state && state.status === "running" ? steps[state.step] : undefined;

  // Find and follow the highlighted element.
  useLayoutEffect(() => {
    if (!step?.target) { setBox(null); return; }
    const place = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) { setBox(null); return; }
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    place();
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [step?.target]);

  // Escape pauses.
  useEffect(() => {
    if (!step || !state) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") update(pause(state)); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [step, state, update]);

  if (!active || !state) return null;
  const label = TOUR_TITLES[active];

  if (shouldPrompt(state, Date.now()) && !forced) {
    return (
      <div role="dialog" aria-label="Take a tour" data-floating className="glass fixed bottom-20 left-4 z-[60] sm:bottom-4 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border p-4 shadow-xl">
        <p className="font-bold">Quick guide: {label}.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => update(start(state))}>Start tour</Button>
          <Button size="sm" variant="outline" onClick={() => update(snooze(state, Date.now()))}>Remind me tomorrow</Button>
          <Button size="sm" variant="ghost" onClick={() => update(dismiss(state))}>Don't show again</Button>
        </div>
      </div>
    );
  }

  // After "don't show again" or finishing, a small "?" stays so the guide can always be reopened on this page.
  if (state.status === "dismissed" || state.status === "done" || (state.status === "snoozed" && !shouldPrompt(state, Date.now()))) {
    return (
      <button type="button" data-floating aria-label={`Show the guide: ${label}`} title={`Guide: ${label}`} onClick={() => update(start({ ...state, status: "new", step: 0 }))}
        className="glass fixed bottom-20 left-4 z-40 grid h-10 w-10 place-items-center rounded-full border text-base font-extrabold shadow-lg sm:bottom-4">?</button>
    );
  }

  if (state.status === "paused") {
    return (
      <div className="glass fixed bottom-20 left-4 z-[60] sm:bottom-4 flex items-center gap-2 rounded-full border px-3 py-2 text-sm shadow-lg">
        Tour paused
        <Button size="sm" onClick={() => update(resume(state))}>Resume</Button>
        <Button size="sm" variant="ghost" onClick={() => update(dismiss(state))}>Don't show again</Button>
      </div>
    );
  }

  if (!step) return null;
  const last = state.step === steps.length - 1;
  const below = box ? box.top + box.height + 12 : undefined;
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="false" aria-label={`Tour step ${state.step + 1} of ${steps.length}`}>
      {box ? <div className="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all" style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 9999px rgba(0,0,0,.5)" }} /> : <div className="fixed inset-0 bg-black/50" />}
      <div className="glass fixed w-[min(22rem,calc(100vw-2rem))] rounded-2xl border bg-background p-4 shadow-2xl" style={box ? { top: Math.min(below!, window.innerHeight - 220), left: Math.max(16, Math.min(box.left, window.innerWidth - 368)) } : { top: "30%", left: "50%", transform: "translateX(-50%)" }}>
        <p className="text-xs text-muted-foreground">Step {state.step + 1} of {steps.length}</p>
        <h2 className="mt-1 text-lg font-bold">{step.title}</h2>
        <p className="mt-1 text-sm">{step.text}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {state.step > 0 && <Button size="sm" variant="outline" onClick={() => update(back(state))}>Back</Button>}
          <Button size="sm" onClick={() => update(last ? finish(state) : next(state, steps.length))} autoFocus>{last ? "Finish" : "Next"}</Button>
          <Button size="sm" variant="ghost" onClick={() => update(pause(state))}>Pause</Button>
          <Button size="sm" variant="ghost" onClick={() => update(snooze(state, Date.now()))}>Remind me tomorrow</Button>
        </div>
        <button className="mt-3 text-xs text-muted-foreground underline" onClick={() => update(dismiss(state))}>Don't show again</button>
      </div>
    </div>
  );
}
