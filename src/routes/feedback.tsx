import { createFileRoute } from "@tanstack/react-router";
import { FeedbackForm } from "@/components/feedback/feedback-form";

export const Route = createFileRoute("/feedback")({
  validateSearch: (s: Record<string, unknown>): { from?: string } => (typeof s["from"] === "string" && s["from"].startsWith("/") ? { from: s["from"].slice(0, 200) } : {}),
  head: () => ({ meta: [{ title: "Feedback | Hodii" }, { name: "description", content: "Tell the Hodii team what works, what does not, and what you would like us to build." }] }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { from } = Route.useSearch();
  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 pb-16 pt-28">
      <h1 className="text-3xl font-extrabold">Feedback</h1>
      <p className="mt-2 text-muted-foreground">Quick selection, then a few words. Good or bad, we read all of it.</p>
      <div className="glass mt-6 rounded-3xl p-5 sm:p-7"><FeedbackForm {...(from ? { from } : {})} /></div>
    </main>
  );
}
