import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { shareLink } from "@/lib/share";

/** Opens the phone's share sheet where there is one, and copies the link where there is not. */
export function ShareButton({ title, label = "Share", className = "" }: { title: string; label?: string; className?: string }) {
  const go = async () => {
    const r = await shareLink(title, window.location.href);
    if (r === "copied") toast.success("Link copied. Paste it anywhere to share.");
    else if (r === "failed") toast.error("Could not share. Copy the address from your browser instead.");
  };
  return <button type="button" onClick={go} className={`inline-flex h-10 items-center gap-2 rounded-full border border-input bg-background px-4 text-sm font-bold ${className}`}><Share2 className="size-4" aria-hidden />{label}</button>;
}
