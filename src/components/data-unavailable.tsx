import { RefreshCw } from "lucide-react";

/** Shown in place of content when listings can't be fetched; never blanks the page. */
export function DataUnavailable({ title = "We couldn't load listings right now", text = "The property database isn't reachable at the moment. Please try again in a moment." }: { title?: string; text?: string }) {
  return (
    <div className="empty-card mx-auto max-w-lg p-8 text-center" role="status">
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-2 text-muted-foreground">{text}</p>
      <button type="button" onClick={() => location.reload()} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"><RefreshCw className="h-4 w-4" /> Try again</button>
    </div>
  );
}
