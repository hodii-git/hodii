import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { transcribeVoice, voiceStatusQuery } from "@/lib/voice.functions";
import { retry } from "@/lib/retry";
import { POPUP_CARD, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const toBase64 = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

/** A microphone inside the search box: tap, speak, tap again. The words come back as text, so typing always remains the fallback. */
export function VoiceButton({ onText, inline = false, className = "" }: { onText: (text: string) => void; /** Sits in the flow of a flex row instead of floating over the right edge of the field. */ inline?: boolean; className?: string }) {
  const qc = useQueryClient();
  const { data: status } = useQuery(voiceStatusQuery);
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const [left, setLeft] = useState(0);
  const [info, setInfo] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  const speech = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const Speech = typeof window !== "undefined" ? ((window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: SpeechCtor }).webkitSpeechRecognition) : undefined;
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); speech.current?.abort(); }, []);
  const server = supported && !!status?.enabled;
  const btn = useRef<HTMLButtonElement | null>(null);

  /** Reads the real microphone loudness while recording and feeds it to the pulsing rings (CSS variable --lvl, 0 to 1). */
  useEffect(() => {
    if (state !== "rec") { btn.current?.style.setProperty("--lvl", "0"); return; }
    let stop = false, raf = 0, ctx: AudioContext | null = null, stream: MediaStream | null = null, smooth = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        ctx = new AC(); const an = ctx.createAnalyser(); an.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.fftSize);
        const loop = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0; for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
          const rms = Math.min(1, Math.sqrt(sum / buf.length) * 5);
          smooth = smooth * 0.7 + rms * 0.3;
          btn.current?.style.setProperty("--lvl", smooth.toFixed(3));
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch { /* no level effect: recording itself is unaffected */ }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); void ctx?.close(); };
  }, [state]);

  /** The browser's own speech recognition: no server, no limit, works wherever the browser offers it. */
  /** Asks the browser for the microphone straight away, so the permission prompt appears on the first tap instead of failing silently. */
  const ensureMic = async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) return true; // the browser's speech recognition asks for itself
    try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()); return true; }
    catch { setInfo("Allow microphone access in your browser (the lock icon beside the address), then tap the microphone again. You can always type your search."); return false; }
  };

  /** The browser's own speech recognition. Stops when you say "stop", or after a pause. */
  const startBrowser = () => {
    if (!Speech) { setInfo("This browser cannot listen for voice search. Try Chrome, Edge or Safari, or just type what you are looking for."); return; }
    const r = new Speech();
    r.lang = "en-KE"; r.interimResults = true; r.maxAlternatives = 1; r.continuous = true;
    let said = "", done = false, quiet: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (done) return; done = true; clearTimeout(quiet);
      const text = said.replace(/\b(?:please\s+)?stop(?:\s+(?:listening|recording|talking))?[.!?]*\s*$/i, "").trim();
      try { r.stop(); } catch { /* already stopped */ }
      if (text) onText(text); else toast.error("We did not catch that. Please try again.");
    };
    r.onresult = (e) => {
      said = Array.from({ length: e.results.length }, (_, i) => e.results[i]?.[0]?.transcript ?? "").join(" ").replace(/\s+/g, " ").trim();
      clearTimeout(quiet);
      if (/\bstop(?:\s+(?:listening|recording|talking))?[.!?]*\s*$/i.test(said)) { finish(); return; }
      quiet = setTimeout(finish, 2200);
    };
    r.onerror = (e) => { clearTimeout(quiet); setState("idle"); if (e.error === "not-allowed" || e.error === "service-not-allowed") setInfo("Allow microphone access in your browser settings, or type your search."); else if (e.error !== "aborted" && e.error !== "no-speech") toast.error("Voice search stopped. Please try again."); };
    r.onend = () => { clearTimeout(quiet); if (!done && said.trim()) { done = true; onText(said.trim()); } speech.current = null; setState("idle"); };
    speech.current = { stop: () => { finish(); }, abort: () => { done = true; clearTimeout(quiet); try { r.abort(); } catch { /* ignore */ } } };
    setState("rec"); setLeft(0);
    try { r.start(); } catch { setState("idle"); }
  };

  const stop = () => { if (speech.current) { speech.current.stop(); return; } if (timer.current) { clearInterval(timer.current); timer.current = null; } if (rec.current?.state === "recording") rec.current.stop(); };

  const send = async (blob: Blob) => {
    setState("busy");
    try {
      const audio = await toBase64(blob);
      // A dropped connection is retried a few times; a refusal (limit, nothing heard) is shown straight away.
      const r = await retry(() => transcribeVoice({ data: { audio, mime: blob.type || "audio/webm" } }), { tries: 3, baseMs: 700 });
      void qc.invalidateQueries({ queryKey: voiceStatusQuery.queryKey });
      if (r.ok) { onText(r.text); if (r.status.remaining <= 2) toast.message(`${r.status.remaining} voice search${r.status.remaining === 1 ? "" : "es"} left for now.`); }
      else toast.error(r.message);
    } catch { toast.error("Voice search could not reach the server. Please type your search or try again."); }
    finally { setState("idle"); }
  };

  const start = async () => {
    if (state !== "idle") return;
    if (!(await ensureMic())) return;
    if (!server) { startBrowser(); return; }
    if (!status) { setInfo("Voice search could not start right now. Please type what you are looking for."); return; }
    if ((status.remaining ?? 1) <= 0) { setInfo("You have used all your voice searches for now. Typing your search still works, and voice comes back soon."); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { setInfo("We could not use your microphone. Allow microphone access in your browser settings, or type your search."); return; }
    const type = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); void send(new Blob(chunks, { type: mr.mimeType || type || "audio/webm" })); };
    rec.current = mr; mr.start();
    // Stop by itself after a pause in speaking, so nobody has to find the button again.
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        const ctx = new AC(), an = ctx.createAnalyser(); an.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.fftSize); let spoke = false, quietSince = 0;
        const tick = setInterval(() => {
          if (mr.state !== "recording") { clearInterval(tick); void ctx.close(); return; }
          an.getByteTimeDomainData(buf);
          let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          if (peak > 14) { spoke = true; quietSince = 0; } else if (spoke) { quietSince ||= Date.now(); if (Date.now() - quietSince > 1800) { clearInterval(tick); stop(); } }
        }, 150);
      }
    } catch { /* no silence detection: the stop button and the time limit still work */ }
    setState("rec"); setLeft(status.maxSeconds);
    timer.current = setInterval(() => setLeft((s) => { if (s <= 1) { stop(); return 0; } return s - 1; }), 1000);
  };

  return (<>
    <button ref={btn} type="button" onClick={state === "rec" ? stop : start} disabled={state === "busy"} aria-label={state === "rec" ? "Stop recording" : "Search by voice"} aria-pressed={state === "rec"} title={state === "rec" ? "Tap to stop" : "Speak your search"}
      className={`${inline ? "voice-btn-inline relative isolate size-9" : "voice-btn absolute right-1.5 top-1/2 size-9 -translate-y-1/2"} inline-grid shrink-0 place-items-center rounded-full text-xs font-bold ${state === "rec" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"} ${className}`}>
      {state === "busy" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : state === "rec" ? <><span className="voice-ring" aria-hidden /><span className="voice-ring voice-ring-2" aria-hidden /><Mic className="relative size-5" aria-hidden /></> : <Mic className="size-5" aria-hidden />}
    </button>
    <Dialog open={info !== null} onOpenChange={(o) => { if (!o) setInfo(null); }}>
      <DialogContent className={`${POPUP_CARD} sm:max-w-md [&>*]:min-w-0`}>
        <DialogHeader className="text-left">
          <DialogTitle>Voice search</DialogTitle>
          <DialogDescription className="sr-only">Why voice search did not start</DialogDescription>
        </DialogHeader>
        <div role="note" className="popup-note"><p className="font-bold">Not available right now</p><p className="mt-0.5 text-muted-foreground">{info}</p></div>
        <button type="button" onClick={() => setInfo(null)} className="mt-1 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">Got it</button>
      </DialogContent>
    </Dialog></>
  );
}

type SpeechCtor = new () => {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
