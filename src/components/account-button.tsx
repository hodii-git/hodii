import { Link } from "@tanstack/react-router";
import { Bell, Heart, LogOut, UserRound, LayoutDashboard, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuthReturn } from "@/lib/auth-return";
import { useAuth } from "@/hooks/use-auth";

import { MenuText, toneAt } from "@/components/ui/tone-icon";

export function UserAvatar({ name, hue = 280, size = "md", src = null }: { name: string; hue?: number; size?: "sm" | "md" | "lg"; src?: string | null | undefined }) {
  const dims = size === "lg" ? "h-24 w-24 text-3xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  if (src) return <img src={src.replace("/image/upload/", "/image/upload/c_fill,g_face,w_160,h_160,q_auto,f_auto/")} alt="" aria-hidden className={`${dims} rounded-full object-cover`} />;
  return (
    <span aria-hidden className={`avatar-orb ${dims}`} style={{ ["--avatar-hue" as string]: hue }}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AccountButton({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const { user, loading, signOut } = useAuth();
  const back = useAuthReturn();
  if (loading) return <span className="h-10 w-10" aria-hidden />;
  if (!user) {
    return (
      // On phone widths the compact header keeps only the Report button.
      <Button asChild variant="ghost" className={`rounded-full px-4 h-10 shrink-0 font-medium whitespace-nowrap header-hover hover:bg-transparent max-sm:px-3 max-sm:text-sm ${compact ? "hidden sm:inline-flex" : ""}`}>
        <Link to="/auth" search={back} onClick={onNavigate}>Sign in</Link>
      </Button>
    );
  }
  const name = user.username || user.email || "Account";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Your account" className="hdr-circle header-circle grid shrink-0 place-items-center overflow-hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring [&>*]:!size-full">
        <UserAvatar name={name} size="sm" src={user.avatarUrl} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-menu w-[min(30rem,calc(100vw-1.5rem))] max-h-[min(85dvh,44rem)] pad-fixed overflow-y-auto overscroll-contain rounded-3xl px-4 sm:px-5">
        <div className="popup-note mb-4 flex items-center gap-3">
          <span className="hdr-circle overflow-hidden rounded-full [&>*]:!size-full"><UserAvatar name={name} size="sm" src={user.avatarUrl} /></span>
          <span className="min-w-0"><span className="block truncate font-bold">{name}</span><span className="block truncate text-xs text-muted-foreground">{user.email}</span></span>
        </div>
        <p className="mb-2 text-sm font-bold">Your account</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <DropdownMenuItem asChild className="menu-card"><Link to="/dashboard" onClick={onNavigate}><span className={`menu-tile ${toneAt(0)}`}><LayoutDashboard aria-hidden /></span><MenuText label="Enquiries" hint="Messages you sent" /></Link></DropdownMenuItem>
          <DropdownMenuItem asChild className="menu-card"><Link to="/saved" onClick={onNavigate}><span className={`menu-tile ${toneAt(1)}`}><Heart aria-hidden /></span><MenuText label="Saved" hint="Homes and searches" /></Link></DropdownMenuItem>
          <DropdownMenuItem asChild className="menu-card"><Link to="/notifications" onClick={onNavigate}><span className={`menu-tile ${toneAt(2)}`}><Bell aria-hidden /></span><MenuText label="Notifications" hint="Replies and alerts" /></Link></DropdownMenuItem>
          <DropdownMenuItem asChild className="menu-card"><Link to="/profile" onClick={onNavigate}><span className={`menu-tile ${toneAt(3)}`}><UserRound aria-hidden /></span><MenuText label="Your profile" hint="Name, photo, security" /></Link></DropdownMenuItem>
          {user.agencies.map((a) => <DropdownMenuItem key={a.id} asChild className="menu-card"><Link to="/dashboard/agency/$slug" params={{ slug: a.slug }} onClick={onNavigate}><span className={`menu-tile ${toneAt(4)}`}><Building2 aria-hidden /></span><MenuText label={a.name} hint="Agency dashboard" /></Link></DropdownMenuItem>)}
          <DropdownMenuItem className="menu-card" onSelect={() => signOut()}><span className={`menu-tile ${toneAt(5)}`}><LogOut aria-hidden /></span><MenuText label="Sign out" hint="On this device" /></DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
