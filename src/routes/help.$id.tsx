import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ARTICLES } from "@/data/guide";
import { GuideBody } from "@/components/help/guide";

export const Route = createFileRoute("/help/$id")({
  loader: ({ params }) => { const a = ARTICLES.find((x) => x.id === params.id); if (!a) throw notFound(); return { a }; },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.a.title ?? "Help"} | Hodii` }, { name: "description", content: loaderData?.a.summary ?? "" }] }),
  component: Article,
});

function Article() {
  const { a } = Route.useLoaderData();
  const rel = (a.related ?? []).map((id) => ARTICLES.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 pb-16 pt-28">
      <Link to="/help" search={{ for: a.audience }} className="text-sm underline">← All guides</Link>
      <h1 className="mt-3 text-3xl font-extrabold">{a.title}</h1>
      <p className="mt-1 text-muted-foreground">{a.summary}</p>
      <div className="mt-6"><GuideBody blocks={a.body} /></div>
      {rel.length > 0 && <aside className="mt-10"><h2 className="font-bold">Related</h2><ul className="mt-2 list-disc pl-5">{rel.map((r) => <li key={r.id}><Link to="/help/$id" params={{ id: r.id }} className="underline">{r.title}</Link></li>)}</ul></aside>}
      <p className="mt-10 text-sm text-muted-foreground">Still stuck? <Link to="/feedback" className="underline">Tell us</Link>.</p>
    </main>
  );
}
