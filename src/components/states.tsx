import { Inbox, Newspaper, Search as SearchIcon, SearchX } from "lucide-react";
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
    <main className="mx-auto w-full max-w-[82rem] flex-1 px-4 pt-32 pb-24 md:pt-40" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-2/3 max-w-md skeleton" />
      <div className="card-cq mt-10"><div className="card-grid gap-3 sm:gap-4">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-64 skeleton !rounded-2xl" />)}
      </div></div>
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
    <div className="empty-card mx-auto w-full max-w-md px-6 py-12">
      {icon && <span className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary [&>svg]:h-6 [&>svg]:w-6" aria-hidden>{icon}</span>}
      <p className="text-base font-extrabold">{title}</p>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

const CARD_ICONS: Record<string, React.ReactNode> = { search: <SearchIcon />, "search-x": <SearchX />, inbox: <Inbox />, news: <Newspaper /> };
/** A small empty card with a named icon and one line of text. */
export function EmptyCard({ text, icon, className = "" }: { text: string; icon?: string; className?: string }) {
  return <div className={`empty-card mx-auto w-full max-w-md px-6 py-12 ${className}`}>{icon && CARD_ICONS[icon] && <span className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary [&>svg]:h-6 [&>svg]:w-6" aria-hidden>{CARD_ICONS[icon]}</span>}<p className="text-sm text-muted-foreground">{text}</p></div>;
}
