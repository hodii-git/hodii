import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { MessageSquareHeart } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FeedbackForm } from "./feedback-form";

/** The floating Feedback button, on every public page at the bottom right. Opens the form in a window so nobody loses their place. */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/feedback") return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" data-feedback-button data-tour="feedback"
        className="fixed bottom-4 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-lg ring-1 ring-black/10 transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring sm:bottom-6 sm:right-6 print:hidden">
        <MessageSquareHeart className="h-5 w-5" aria-hidden /><span className="hidden sm:inline">Feedback</span><span className="sr-only sm:hidden">Send feedback</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tell us what you think</DialogTitle>
            <DialogDescription>Quick and anonymous unless you choose otherwise. <Link to="/feedback" onClick={() => setOpen(false)} className="underline">Open as a page</Link>.</DialogDescription>
          </DialogHeader>
          <FeedbackForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
