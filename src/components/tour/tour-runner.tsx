import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Compass, X } from "lucide-react";
import { ToneIcon, POP_BTN, POP_BTN_GHOST, POP_BTN_OUTLINE } from "@/components/ui/tone-icon";
import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getTourProgress, saveTourProgress } from "@/lib/tour.functions";
import { TOURS, TOUR_EVENT, TOUR_TITLES, back, dismiss, finish, load, next, pause, resume, save, shouldPrompt, snooze, start, tourForPath, type TourId, type TourState } from "@/lib/tour";

type Box = { top: number; left: number; width: number; height: number } | null;
const PAD = 6;

export function TourRunner() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();
  const who = user?.id ?? "guest";
  const id = tourForPath(path, !!user);
  const [state, setState] = useState<TourState | null>(null);
  const [forced, setForced] = useState<TourId | null>(null);
  // Moving to another page ends a restarted tour; that page has its own.
  useEffect(() => { setForced(null); }, [path]);
  const active = forced ?? id;
  const [box, setBox] = useState<Box>(null);
  // Clicking outside the prompt or the paused pill puts it away until the next page.
  const [hidden, setHidden] = useState(false);
  useEffect(() => { setHidden(false); }, [path]);
  const card = useRef<HTMLDivElement>(null);
  const stepCard = useRef<HTMLDivElement>(null);

  // One choice covers every page's guide: "remind me tomorrow", "don't show again" or finishing a tour quiets the prompt cards everywhere
  // (the dashboard alone has several guides). The "?" button and Help still start any tour on demand.
  const ALL = "all" as TourId;
  const [mute, setMute] = useState<TourState | null>(null);
  useEffect(() => {
    setMute(load(ALL, who));
    if (!user) return;
    let off = false;
    void getTourProgress({ data: { tour: ALL } }).then((r) => {
      if (off || !r) return;
      const local = load(ALL, who);
      if ((r.at ?? 0) >= (local.at ?? 0)) { const s = { status: r.status, step: r.step, until: r.until, snoozes: r.snoozes, at: r.at } as TourState; save(ALL, who, s); setMute(s); }
    }).catch(() => {});
    return () => { off = true; };
  }, [who, user]);
  const quiet = (s: TourState) => {
    if (s.status !== "snoozed" && s.status !== "dismissed" && s.status !== "done") return;
    const m: TourState = { status: s.status === "snoozed" ? "snoozed" : "dismissed", step: 0, until: s.until, snoozes: 0, at: Date.now() };
    save(ALL, who, m); setMute(m);
    if (user) void saveTourProgress({ data: { tour: ALL, status: m.status, step: 0, until: m.until, snoozes: 0, at: m.at! } }).catch(() => {});
  };
  const muted = !!mute && (mute.status === "dismissed" || (mute.status === "snoozed" && Date.now() < mute.until));

  const update = useCallback((raw: TourState) => {
    const s = { ...raw, at: Date.now() };
    quiet(s);
    if (active) { save(active, who, s); if (user) void saveTourProgress({ data: { tour: active, status: s.status, step: s.step, until: s.until, snoozes: s.snoozes, at: s.at } }).catch(() => {}); }
    setState(s);
  }, [active, who, user]);

  useEffect(() => {
    setState(active ? load(active, who) : null);
    if (!active || !user) return;
    // Signed in: what we saved on the server follows the person to any device and wins over this browser's copy.
    let off = false;
    void getTourProgress({ data: { tour: active } }).then((r) => {
      if (off) return;
      const local = load(active, who);
      // The newer change wins, so a slow or failed save can never bring back a tour that was just snoozed, dismissed or finished.
      if (r && (r.at ?? 0) >= (local.at ?? 0)) { const s = { status: r.status, step: r.step, until: r.until, snoozes: r.snoozes, at: r.at } as TourState; save(active, who, s); setState(s); }
      else if (local.status !== "new") void saveTourProgress({ data: { tour: active, status: local.status, step: local.step, until: local.until, snoozes: local.snoozes, at: local.at ?? 0 } }).catch(() => {});
    }).catch(() => {});
    return () => { off = true; };
  }, [active, who, user]);
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<TourId | "here">).detail; const t = d === "here" ? tourForPath(window.location.pathname, !!user) : d; if (!t) return; setForced(t); const s = start({ ...load(t, who), status: "new", step: 0 }); const s2 = { ...s, at: Date.now() }; save(t, who, s2); setState(s2); };
    window.addEventListener(TOUR_EVENT, on);
    return () => window.removeEventListener(TOUR_EVENT, on);
  }, [who, user]);

  const steps = active ? TOURS[active] : [];
  const step = state && state.status === "running" ? steps[state.step] : undefined;

  // Find and follow the highlighted element.
  useLayoutEffect(() => {
    if (!step?.target) { setBox(null); return; }
    const find = () => {
      const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${step.target}"]`));
      return all.find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null;
    };
    const measure = () => {
      const el = find();
      if (!el) { setBox(null); return; }
      const r = el.getBoundingClientRect();
      setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    const place = () => {
      const el = find();
      if (!el) { setBox(null); return; }
      // Bring the exact element into the middle of the screen (clear of the fixed header), then follow it while it scrolls.
      const r = el.getBoundingClientRect();
      const off = r.top < 96 || r.bottom > window.innerHeight - 24;
      if (off) el.scrollIntoView({ block: "center", behavior: "smooth" });
      measure();
    };
    place();
    const t = window.setTimeout(measure, 450);
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    return () => { window.clearTimeout(t); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [step?.target]);

  // Escape pauses.
  useEffect(() => {
    if (!step || !state) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") update(pause(state)); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [step, state, update]);

  const promptOpen = !!state && (shouldPrompt(state, Date.now()) && !forced && !muted || state.status === "paused");
  useEffect(() => {
    if (!promptOpen || hidden) return;
    const away = (e: MouseEvent | TouchEvent) => { if (card.current && !card.current.contains(e.target as Node)) setHidden(true); };
    document.addEventListener("mousedown", away); document.addEventListener("touchstart", away);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); };
  }, [promptOpen, hidden]);

  // Wait until we know who is signed in: before that, this browser's guest copy says "new" and the prompt would flash up again.
  if (!active || !state || loading) return null;
  const label = TOUR_TITLES[active];

  if (shouldPrompt(state, Date.now()) && !forced && !muted) {
    if (hidden) return null;
    return (
      <div ref={card} role="dialog" aria-label="Take a tour" data-floating className="tour-prompt keep-tones glass-menu popup-clean fixed bottom-4 left-3 z-[95] sm:bottom-6 sm:left-6 w-[calc(100vw-1.5rem)] sm:w-[24rem] lg:w-[26rem] rounded-3xl p-5 pb-6">
        <button type="button" aria-label="Close" onClick={() => setHidden(true)} className="close-circle absolute right-3 top-3 z-10 disabled:pointer-events-none"><X className="size-4" aria-hidden /></button>
        <div className="flex items-center gap-3 pr-8"><ToneIcon icon={Compass} tone="other" /><p className="font-bold">Quick guide: {label}.</p></div>
        <p className="popup-note mt-3">A short walk through this page. You can pause or stop it at any time.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" className={POP_BTN} onClick={() => update(start(state))}>Start tour</Button>
          <Button size="sm" variant="outline" className={POP_BTN_OUTLINE} onClick={() => update(snooze(state, Date.now()))}>Remind me tomorrow</Button>
          <Button size="sm" variant="ghost" className={POP_BTN_GHOST} onClick={() => update(dismiss(state))}>Don't show again</Button>
        </div>
      </div>
    );
  }

  // After "don't show again" or finishing, a small "?" stays so the guide can always be reopened on this page.
  if (state.status === "dismissed" || state.status === "done" || (state.status === "snoozed" && !shouldPrompt(state, Date.now())) || (shouldPrompt(state, Date.now()) && muted && !forced)) {
    return (
      <button type="button" data-floating aria-label={`Show the guide: ${label}`} title={`Guide: ${label}`} onClick={() => update(start({ ...state, status: "new", step: 0 }))}
        className="tour-prompt glass fixed bottom-4 left-4 z-40 hidden h-12 w-12 place-items-center rounded-full border text-base md:grid font-extrabold shadow-lg sm:bottom-6 sm:left-6">?</button>
    );
  }

  if (state.status === "paused") {
    return (
      hidden ? null : <div ref={card} data-floating className="tour-prompt tour-paused keep-tones glass-menu popup-clean fixed bottom-4 left-3 z-[95] sm:bottom-6 sm:left-6">
        <button type="button" className="resume-btn" onClick={() => update(resume(state))}><Compass className="size-4" aria-hidden />Resume guide</button>
        <button type="button" className="resume-x" aria-label="Stop the guide" title="Stop the guide" onClick={() => update(dismiss(state))}><X className="size-4" aria-hidden /></button>
      </div>
    );
  }

  if (!step) return null;
  const last = state.step === steps.length - 1;
  const below = box ? box.top + box.height + 12 : undefined;
  return (
    <div className="fixed inset-0 z-[70]" onMouseDown={(e) => { if (!stepCard.current?.contains(e.target as Node)) update(pause(state)); }} role="dialog" aria-modal="false" aria-label={`Tour step ${state.step + 1} of ${steps.length}`}>
      {box ? <div className="pointer-events-none fixed rounded-xl ring-2 ring-foreground/60 transition-all" style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 9999px rgba(15,23,42,0.28), 0 0 0 6px rgba(255,255,255,0.7)" }} /> : <div className="fixed inset-0" />}
      <div ref={stepCard} className="glass-menu popup-clean fixed w-[min(24rem,calc(100vw-1.5rem))] rounded-3xl p-5 pb-6" style={box ? { top: (below ?? 0) + 340 > window.innerHeight ? Math.max(12, box!.top - 340) : (below ?? 0), left: Math.max(12, Math.min(box.left, window.innerWidth - Math.min(384, window.innerWidth - 24) - 12)) } : { top: "30%", left: "50%", transform: "translateX(-50%)" }}>
        <div className="flex items-center gap-3"><ToneIcon icon={Compass} tone="other" /><div className="min-w-0"><p className="text-xs text-muted-foreground">Step {state.step + 1} of {steps.length}</p>
        <h2 className="text-lg font-bold">{step.title}</h2></div></div>
        <p className="popup-note mt-3">{step.text}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {state.step > 0 && <Button size="sm" variant="outline" className={POP_BTN_OUTLINE} onClick={() => update(back(state))}>Back</Button>}
          <Button size="sm" className={POP_BTN} onClick={() => update(last ? finish(state) : next(state, steps.length))} autoFocus>{last ? "Finish" : "Next"}</Button>
          <Button size="sm" variant="ghost" className={POP_BTN_GHOST} onClick={() => update(pause(state))}>Pause</Button>
          <Button size="sm" variant="ghost" className={POP_BTN_GHOST} onClick={() => update(snooze(state, Date.now()))}>Remind me tomorrow</Button>
        </div>
        <button className="mt-3 rounded-full px-2 py-1 text-xs text-muted-foreground underline transition hover:bg-muted hover:text-foreground" onClick={() => update(dismiss(state))}>Don't show again</button>
      </div>
    </div>
  );
}
