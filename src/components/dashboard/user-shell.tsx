import { PageTitle } from "@/components/dashboard/ui";
import type { ReactNode } from "react";
import { Bell, Building2, Heart, Inbox, UserRound } from "lucide-react";
import { UserAvatar } from "@/components/account-button";
import { useAuth } from "@/hooks/use-auth";
import { useUnread } from "@/components/notification-bell";
import { DashFrame } from "@/components/dashboard/dash-frame";
import { DashHeader } from "@/components/dashboard/dash-header";
import { AttentionCard, type Attention } from "@/components/dashboard/attention";

/** The personal account area: Profile first, then Enquiries, Saved and Notifications. */
export function UserShell({ title, sub, children, aside, attention = [] }: { title: string; sub?: string; children: ReactNode; aside?: ReactNode; attention?: Attention[] }) {
  const { user } = useAuth();
  const unread = useUnread();
  const name = user?.username ?? "You";
  const items: Attention[] = [...attention];
  if (unread > 0) items.push({ id: "unread", level: "info", title: `${unread} unread notification${unread === 1 ? "" : "s"}`, text: "New matches, replies and price drops are waiting.", to: "/notifications", cta: "Open" });
  if (user && !user.avatarUrl) items.push({ id: "photo", level: "info", title: "Add a profile photo", text: "Agents reply faster to people they can put a face to.", to: "/profile", cta: "Open profile" });
  return (
    <DashFrame
      label="Account sections"
      bar={<DashHeader framed />}
      brand={<div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-3"><UserAvatar name={name} src={user?.avatarUrl} size="md" /><div className="min-w-0"><p className="truncate font-extrabold">{name}</p><p className="text-xs text-muted-foreground">Your account</p></div></div>}
      groups={[{ items: [
        { key: "profile", to: "/profile", label: "Profile", icon: UserRound },
        { key: "enq", to: "/dashboard", label: "Enquiries", icon: Inbox, exact: true },
        { key: "saved", to: "/saved", label: "Saved", icon: Heart },
        { key: "notes", to: "/notifications", label: "Notifications", icon: Bell, badge: unread },
        ...(user && user.agencies.length > 0 ? [{ key: "agencies", label: "Agencies", icon: Building2, sub: user.agencies.map((g) => ({ key: g.id, label: g.name, to: "/dashboard/agency/$slug", params: { slug: g.slug } })) }] : []),
      ] }]}
      extra={aside}
    >
      <PageTitle title={title} sub={sub} />
      <div><AttentionCard items={items} overview={title === "Profile"} /></div>
      <div className="mt-6">{children}</div>
    </DashFrame>
  );
}

export const CARD = "rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6";
