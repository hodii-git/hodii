import { LoaderBlock } from "@/components/loader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Building2, Heart, Plus } from "lucide-react";
import { Badge, btnGhost, btnPrimary } from "@/components/dashboard/ui";
import { useAuth } from "@/hooks/use-auth";
import { EnquiryThread } from "@/components/enquiry-thread";
import { getMyEnquiries, getMyThread, replyAsEnquirer } from "@/lib/dashboard.functions";
import { timeAgo } from "@/lib/format";

const enquiriesQuery = queryOptions({ queryKey: ["me", "enquiries"], queryFn: () => getMyEnquiries(), staleTime: 15_000 });

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Your dashboard — Hodii" }, { name: "robots", content: "noindex" }] }),
  component: PersonalDashboard,
});

function PersonalDashboard() {
  const { user } = useAuth();
  const enquiries = useQuery(enquiriesQuery);
  const [chat, setChat] = useState<string | null>(null);
  return (
    <main className="mx-auto max-w-[82rem] px-4 pt-28 pb-24">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Hello, {user?.username}</h1>
      <p className="mt-1 text-muted-foreground">Your enquiries, your agencies and your saved properties.</p>

      <section aria-labelledby="mine" className="glass mt-8 flex flex-col gap-4 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><Building2 className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden /><div><h2 id="mine" className="text-lg font-extrabold">{user?.agencies.length ? "Your agencies" : "Want to list property?"}</h2><p className="text-sm text-muted-foreground">{user?.agencies.length ? "Manage listings, enquiries and your team." : "Create an agency in a minute. You can add listings and team members straight away."}</p></div></div>
        <div className="flex flex-wrap gap-2">
          {user?.agencies.map((a) => <Link key={a.id} to="/dashboard/agency/$slug" params={{ slug: a.slug }} className={btnGhost}>{a.name}</Link>)}
          <Link to="/dashboard/agency/new" className={btnPrimary}><Plus className="h-4 w-4" aria-hidden />New agency</Link>
        </div>
      </section>

      <section aria-labelledby="saved" className="glass mt-8 flex flex-wrap items-center justify-between gap-3 rounded-3xl p-6">
        <div className="flex items-start gap-3"><Heart className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden /><div><h2 id="saved" className="text-lg font-extrabold">Saved properties and searches</h2><p className="text-sm text-muted-foreground">Keep an eye on the listings you like and get told about new matches.</p></div></div>
        <Link to="/saved" className={btnGhost}>Open saved</Link>
      </section>

      <section aria-labelledby="enq" className="mt-12">
        <h2 id="enq" className="mb-5 text-2xl font-extrabold">Your enquiries</h2>
        {enquiries.isPending ? <LoaderBlock className="py-10" /> : !enquiries.data?.length ? <div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">Enquiries you send while signed in will show here.</p></div> : (
          <ul className="space-y-3">
            {enquiries.data.map((e) => (
              <li key={e.id} className="glass rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{e.propertyTitle}</p><Badge value={e.status} /></div>
                <p className="mt-1 text-xs text-muted-foreground">Ref {e.propertyRef} · {timeAgo(e.createdAt)}</p>
                <p className="mt-2 line-clamp-2 text-sm">{e.message}</p>
                <button type="button" aria-expanded={chat === e.id} onClick={() => setChat(chat === e.id ? null : e.id)} className="mt-2 text-sm font-semibold text-primary">{chat === e.id ? "Hide conversation" : "Conversation"}{e.unread > 0 && chat !== e.id ? ` (${e.unread} new)` : ""}</button>
                {chat === e.id && <div className="mt-3 border-t border-border pt-3"><EnquiryThread queryKey={["me", "thread", e.id]} load={() => getMyThread({ data: { enquiryId: e.id } })} send={(body) => replyAsEnquirer({ data: { enquiryId: e.id, body } })} note="The agency has not written yet. Their reply will appear here and in your notifications." placeholder="Write back to the agency" /></div>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
