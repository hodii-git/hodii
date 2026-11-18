import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { toggleSavedListing } from "@/lib/properties.functions";
import { visitorId } from "@/lib/visitor";

/** Heart on a card or listing. Signed-out visitors are sent to sign in and come back. */
export function SaveButton({ propertyId, saved = false, label = false }: { propertyId: string; saved?: boolean | undefined; label?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [on, setOn] = useState(saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => setOn(saved), [saved]);

  const click = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { navigate({ to: "/auth", search: { redirect: window.location.pathname + window.location.search } }); return; }
    setBusy(true); setOn((v) => !v); // show the change straight away; undone below if it fails
    try {
      const r = await toggleSavedListing({ data: { propertyId, visitorId: visitorId() } });
      setOn(r.saved);
      toast.success(r.saved ? "Saved to your account" : "Removed from saved");
      qc.invalidateQueries({ queryKey: ["saved"] });
    } catch (err) { setOn((v) => !v); toast.error(err instanceof Error ? err.message : "Could not save this listing"); }
    finally { setBusy(false); }
  };

  return (
    <button type="button" data-tour="save" onClick={click} disabled={busy} aria-pressed={on} aria-label={on ? "Remove from saved" : "Save this property"} className={`relative z-10 inline-flex items-center gap-2 rounded-full bg-background/90 p-2 text-sm font-semibold shadow backdrop-blur transition hover:scale-105 ${label ? "px-4" : ""}`}>
      <Heart className={`h-4 w-4 ${on ? "fill-red-500 text-red-500" : ""}`} aria-hidden />
      {label && <span>{on ? "Saved" : "Save"}</span>}
    </button>
  );
}
