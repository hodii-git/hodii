import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { categorySearch } from "@/lib/search-url";

/** Header and footer category links keep their old address; each one opens the matching property search. */
export const Route = createFileRoute("/section/$slug")({
  beforeLoad: ({ params }) => {
    if (params.slug === "new-developments") throw redirect({ to: "/developments", statusCode: 301 });
    const c = categorySearch(params.slug);
    if (!c) throw notFound();
    throw redirect({ to: "/", search: c.search, statusCode: 301 });
  },
});
