/** Neutral loading placeholder shown while a route's data arrives. */
export function PageSkeleton() {
  return (
    <main className="mx-auto w-full max-w-[112rem] flex-1 px-4 pt-24 pb-24" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-2/3 max-w-md animate-pulse rounded-xl bg-muted" />
      <div className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">
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
