import { UserShell, CARD } from "@/components/dashboard/user-shell";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/states";
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
    <UserShell title="Notifications" sub="New matches for your saved searches, price drops, enquiries, team invitations and decisions on your listings. Kept for 90 days.">
      {!!list.data?.unread && <div className="mb-3 text-right"><button type="button" onClick={() => actions.read.mutate("all")} className="text-sm font-bold text-primary">Mark all read</button></div>}
      <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
        {list.isPending ? <div className="grid place-items-center py-10"><Loader size="md" label="Loading" /></div>
          : !list.data?.items.length ? <EmptyState icon={<Bell />} title="Nothing yet">Matches, price drops and decisions on your listings will show up here.</EmptyState>
          : <ul className="grid gap-1">{list.data.items.map((n) => <NotificationRow key={n.id} n={n} actions={actions} />)}</ul>}
      </div>
    </UserShell>
  );
}
