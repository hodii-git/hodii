import { LoaderBlock } from "@/components/loader";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, CheckCheck, Heart, MessageSquare, Search, ShieldCheck, TrendingDown, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { deleteNotification, getMyNotifications, getUnreadCount, markNotificationsRead, respondToInvite } from "@/lib/notifications.functions";
import { timeAgo } from "@/lib/format";

const ICONS: Record<string, typeof Bell> = { invitation: Users, enquiry: MessageSquare, listing_decision: Building2, agency_decision: ShieldCheck, saved_search: Search, price_drop: TrendingDown, comment_reply: MessageSquare, comment_on_listing: MessageSquare, comment_like: Heart, listing_expiry: Building2 };
export const unreadKey = ["me", "notifications", "unread"] as const;
export const listKey = ["me", "notifications", "list"] as const;
const POLL_MS = 30_000;

/** The unread number, refreshed every half minute while the page is open. */
export function useUnread() {
  const { user } = useAuth();
  return useQuery({ queryKey: unreadKey, queryFn: () => getUnreadCount(), enabled: !!user, refetchInterval: POLL_MS, refetchOnWindowFocus: true, staleTime: 10_000 }).data?.unread ?? 0;
}

export function useNotificationActions() {
  const qc = useQueryClient();
  const router = useRouter();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["me", "notifications"] }), qc.invalidateQueries({ queryKey: ["saved", "tab-badges"] })]);
  const read = useMutation({ mutationFn: (ids: string[] | "all") => markNotificationsRead({ data: { ids } }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => deleteNotification({ data: { id } }), onSuccess: refresh });
  const respond = useMutation({
    mutationFn: (v: { inviteId: string; accept: boolean }) => respondToInvite({ data: v }),
    onSuccess: async (r, v) => {
      toast.success(v.accept ? "You joined the team" : "Invitation declined");
      await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ["auth", "me"] })]);
      if (v.accept && r.agencySlug) router.history.push(`/dashboard/agency/${r.agencySlug}`);
    },
    onError: (e) => { toast.error((e as Error).message); refresh(); },
  });
  const open = (n: { id: string; link: string | null; read: boolean }) => { if (!n.read) read.mutate([n.id]); if (n.link) router.history.push(n.link); };
  return { read, remove, respond, open };
}

export type NotificationItem = { id: string; kind: string; title: string; body: string; link: string | null; invite: string | null; read: boolean; at: string };

export function NotificationRow({ n, actions, onDone }: { n: NotificationItem; actions: ReturnType<typeof useNotificationActions>; onDone?: () => void }) {
  const Icon = ICONS[n.kind] ?? Bell;
  return (
    <li className={`group relative flex gap-3 rounded-2xl p-3 ${n.read ? "" : "bg-primary/5"}`}>
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted"><Icon className="h-4 w-4" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <button type="button" disabled={!n.link} onClick={() => { actions.open(n); onDone?.(); }} className={`block w-full text-left ${n.link ? "cursor-pointer" : "cursor-default"}`}>
          <p className={`text-sm leading-snug ${n.read ? "font-medium" : "font-bold"}`}>{n.title}</p>
          {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
        </button>
        <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.at)}</p>
        {n.invite && (
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={actions.respond.isPending} onClick={() => actions.respond.mutate({ inviteId: n.invite!, accept: true })} className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Accept</button>
            <button type="button" disabled={actions.respond.isPending} onClick={() => actions.respond.mutate({ inviteId: n.invite!, accept: false })} className="rounded-full border border-border px-3 py-1 text-xs font-bold hover:bg-muted">Decline</button>
          </div>
        )}
      </div>
      <button type="button" aria-label="Remove notification" onClick={() => actions.remove.mutate(n.id)} className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground opacity-0 transition hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100"><X className="h-3.5 w-3.5" /></button>
      {!n.read && <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary group-hover:hidden" aria-label="Unread" />}
    </li>
  );
}

export function NotificationBell() {
  const { user } = useAuth();
  const unread = useUnread();
  const [open, setOpen] = useState(false);
  const actions = useNotificationActions();
  const list = useQuery({ queryKey: listKey, queryFn: () => getMyNotifications(), enabled: !!user && open, staleTime: 5_000 });
  useEffect(() => { if (open) list.refetch(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative grid h-10 w-10 place-items-center rounded-full header-hover focus-visible:ring-2 focus-visible:ring-ring">
          <Bell className="h-5 w-5" aria-hidden />
          {unread > 0 && <span className="absolute right-1 top-1 grid min-w-[1.1rem] place-items-center rounded-full bg-primary px-1 text-[10px] dot-pulse font-extrabold leading-[1.1rem] text-primary-foreground">{unread > 9 ? "9+" : unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="glass-menu w-[min(24rem,calc(100vw-1.5rem))] rounded-3xl p-2">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="font-extrabold">Notifications</p>
          {unread > 0 && <button type="button" onClick={() => actions.read.mutate("all")} className="inline-flex items-center gap-1 text-xs font-bold text-primary"><CheckCheck className="h-3.5 w-3.5" aria-hidden />Mark all read</button>}
        </div>
        <div className="pad-fixed max-h-[28rem] overflow-y-auto">
          {list.isPending ? <LoaderBlock className="py-10" />
            : !list.data?.items.length ? <div className="px-3 py-8 text-center text-sm text-muted-foreground"><Heart className="mx-auto mb-2 h-5 w-5" aria-hidden />Nothing yet. Save a search and we will tell you here when something new matches.</div>
            : <ul className="grid gap-1">{list.data.items.slice(0, 12).map((n) => <NotificationRow key={n.id} n={n} actions={actions} onDone={() => setOpen(false)} />)}</ul>}
        </div>
        <Link to="/notifications" onClick={() => setOpen(false)} className="mt-1 block rounded-2xl px-3 py-2 text-center text-sm font-bold text-primary hover:bg-muted">See all</Link>
      </PopoverContent>
    </Popover>
  );
}
