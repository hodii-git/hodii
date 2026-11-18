import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQuery } from "@/hooks/use-auth";
import { can } from "@/lib/access";

/**
 * Every "List a property" button points here. It sends the person to the right place:
 * not signed in → sign-up as an agency (and back here afterwards); in an agency that can add listings → the new-listing form;
 * signed in without an agency → the page that creates one.
 */
export const Route = createFileRoute("/list-property")({
  ssr: false,
  head: () => ({ meta: [{ title: "List a property — Hodii" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: "/auth", search: { mode: "signup", as: "agency", redirect: "/list-property" } });
    const agency = me.agencies.find((a) => can(a.role, "listing.create"));
    if (agency) throw redirect({ to: "/dashboard/agency/$slug/listings/$id", params: { slug: agency.slug, id: "new" } });
    throw redirect({ to: "/dashboard/agency/new" });
  },
});
