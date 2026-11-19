import { useRouterState } from "@tanstack/react-router";
import { Loader } from "@/components/loader";
/** Pages that really are grids of listings; only these get card placeholders while loading. */
const CARD_PAGES = /^\/(?:properties|developments|saved|agencies)?\/?$|^\/(?:locations|neighbourhoods)\//;

/** Router pending state, chosen by page: card placeholders for listing pages, one well-centred loader for everything else (dashboards, admin, forms, info pages). */
export function PageSkeleton() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (!CARD_PAGES.test(path)) {
    return <main aria-busy="true" className="grid min-h-[70dvh] w-full flex-1 place-items-center px-4"><Loader size="lg" label="Loading" /></main>;
  }
  return (
    <main className="mx-auto w-full max-w-[82rem] flex-1 px-4 pt-24 pb-24" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-2/3 max-w-md animate-pulse rounded-xl bg-muted" />
      <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-40 pb-24 text-center">
      <h1 className="text-4xl font-extrabold">Page not found</h1>
      <p className="mt-3 text-muted-foreground">We could not find that page.</p>
      <a href="/" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Back to home</a>
    </main>
  );
}

/** One designed empty state: centred icon, short title, one line of help, optional action. */
export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border px-6 py-14 text-center">
      {icon && <span className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary [&>svg]:h-6 [&>svg]:w-6" aria-hidden>{icon}</span>}
      <p className="text-base font-extrabold">{title}</p>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
