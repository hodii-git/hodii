import { useToolHint } from "@/components/tool-hint";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { shareLink } from "@/lib/share";

/** Opens the phone's share sheet where there is one, and copies the link where there is not. */
export function ShareButton({ title, label = "Share", className = "" }: { title: string; label?: string; className?: string }) {
  const hint = useToolHint("Share this page");
  const go = async () => {
    const r = await shareLink(title, window.location.href);
    if (r === "copied") toast.success("Link copied. Paste it anywhere to share.");
    else if (r === "failed") toast.error("Could not share. Copy the address from your browser instead.");
  };
  return <span className="relative inline-flex">{hint.bubble}<button type="button" onClick={go} aria-label={label} {...hint.handlers} className={`tool-btn ${className}`}><Share2 className="size-4" aria-hidden /><span className="hidden sm:inline">{label}</span></button></span>;
}
