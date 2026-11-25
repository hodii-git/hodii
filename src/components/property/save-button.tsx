import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { toggleSavedListing } from "@/lib/properties.functions";
import { visitorId } from "@/lib/visitor";

/** Heart on a card or listing. Signed-out visitors are sent to sign in and come back. */
export function SaveButton({ propertyId, saved = false, label = false, onChange }: { propertyId: string; saved?: boolean | undefined; label?: boolean; onChange?: (saved: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [on, setOn] = useState(saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => setOn(saved), [saved]);

  const click = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { navigate({ to: "/auth", search: { redirect: window.location.pathname + window.location.search } }); return; }
    const next = !on;
    setBusy(true); setOn(next); onChange?.(next); // show the change straight away; undone below if it fails
    try {
      const r = await toggleSavedListing({ data: { propertyId, visitorId: visitorId() } });
      setOn(r.saved);
      onChange?.(r.saved);
      toast.success(r.saved ? "Saved to your account" : "Removed from saved");
      qc.invalidateQueries({ queryKey: ["saved"] });
    } catch (err) { setOn(!next); onChange?.(!next); toast.error(err instanceof Error ? err.message : "Could not save this listing"); }
    finally { setBusy(false); }
  };

  return (
    <button type="button" data-tour="save" onClick={click} disabled={busy} aria-pressed={on} aria-label={on ? "Remove from saved" : "Save this property"} className={`relative z-10 inline-flex items-center gap-2 text-sm font-semibold transition hover:scale-110 ${label ? "rounded-full border border-border bg-background px-4 py-2 text-foreground shadow-sm" : "p-0.5 text-white drop-shadow-[0_1px_2px_rgb(0_0_0/45%)]"}`}>
      <Heart className={`${label ? "h-4 w-4" : "h-5 w-5 stroke-[#f4efe4] [stroke-width:2.2px]"} ${on ? "fill-like" : label ? "" : "fill-black/25"}`} aria-hidden />
      {label && <span>{on ? "Saved" : "Save"}</span>}
    </button>
  );
}
