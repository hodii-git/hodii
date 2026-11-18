import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader } from "@/components/loader";
import { NotificationRow, listKey, useNotificationActions } from "@/components/notification-bell";
import { getMyNotifications } from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Hodii" }, { name: "robots", content: "noindex" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const list = useQuery({ queryKey: listKey, queryFn: () => getMyNotifications(), refetchInterval: 30_000 });
  const actions = useNotificationActions();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-28 pb-24">
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold tracking-tight">Notifications</h1><p className="mt-1 text-sm text-muted-foreground">New matches for your saved searches, price drops, enquiries, team invitations and decisions on your listings. Kept for 90 days.</p></div>
        {!!list.data?.unread && <button type="button" onClick={() => actions.read.mutate("all")} className="shrink-0 text-sm font-bold text-primary">Mark all read</button>}
      </div>
      <div className="glass mt-6 rounded-3xl p-2">
        {list.isPending ? <div className="grid place-items-center py-10"><Loader size="md" label="Loading" /></div>
          : !list.data?.items.length ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing yet.</p>
          : <ul className="grid gap-1">{list.data.items.map((n) => <NotificationRow key={n.id} n={n} actions={actions} />)}</ul>}
      </div>
    </main>
  );
}
