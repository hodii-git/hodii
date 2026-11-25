import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { POPUP_CARD, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FeedbackForm } from "./feedback-form";

/** The floating Feedback button, on every public page at the bottom right. Opens the form in a window so nobody loses their place. */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/feedback") return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" data-feedback-button data-tour="feedback"
        className="fb-fab fixed bottom-4 right-4 z-40 inline-flex h-10 w-10 sm:h-12 sm:w-auto items-center justify-center gap-2 rounded-full sm:w-auto sm:justify-start bg-white p-0 sm:pl-2 sm:pr-4 text-sm font-bold text-foreground shadow-[0_6px_18px_-4px_rgb(15_23_42/0.35)] ring-1 ring-black/15 transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring sm:bottom-6 sm:right-6 print:hidden">
        <img src="/icons/fb-idea.svg" alt="" width={28} height={28} className="size-7 rounded-lg" /><span className="hidden sm:inline">Feedback</span><span className="sr-only sm:hidden">Send feedback</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`${POPUP_CARD} keep-tones sm:max-w-xl`}>
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
