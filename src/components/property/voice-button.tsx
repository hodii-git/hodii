import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { transcribeVoice, voiceStatusQuery } from "@/lib/voice.functions";
import { retry } from "@/lib/retry";

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const toBase64 = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

/** A microphone inside the search box: tap, speak, tap again. The words come back as text, so typing always remains the fallback. */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const qc = useQueryClient();
  const { data: status } = useQuery(voiceStatusQuery);
  const [state, setState] = useState<"idle" | "rec" | "busy">("idle");
  const [left, setLeft] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);
  if (!supported || !status?.enabled) return null;

  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } if (rec.current?.state === "recording") rec.current.stop(); };

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
    if ((status.remaining ?? 1) <= 0) { toast.error("You have used all your voice searches for now. You can still type."); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { toast.error("We could not use your microphone. Allow microphone access in your browser, or type your search."); return; }
    const type = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); void send(new Blob(chunks, { type: mr.mimeType || type || "audio/webm" })); };
    rec.current = mr; mr.start();
    setState("rec"); setLeft(status.maxSeconds);
    timer.current = setInterval(() => setLeft((s) => { if (s <= 1) { stop(); return 0; } return s - 1; }), 1000);
  };

  return (
    <button type="button" onClick={state === "rec" ? stop : start} disabled={state === "busy"} aria-label={state === "rec" ? "Stop recording" : "Search by voice"} aria-pressed={state === "rec"} title={state === "rec" ? "Tap to stop" : "Speak your search"}
      className={`absolute right-1.5 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1 rounded-full px-2 text-xs font-bold ${state === "rec" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
      {state === "busy" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : state === "rec" ? <><Square className="size-3.5 fill-current" aria-hidden />{left}s</> : <Mic className="size-4" aria-hidden />}
    </button>
  );
}
