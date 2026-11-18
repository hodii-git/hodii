import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity as Activity_, BarChart3, Check, ChevronsLeft, ChevronsRight, Briefcase, Building2, LayoutDashboard, LogOut, Menu, MessageSquare, Minus,
  Search, ShieldAlert, ShieldCheck, SlidersHorizontal, Star, Trash2, UserCog, Users, UsersRound, X,
} from "lucide-react";
import { Moderation } from "@/components/admin/moderation";
import { Payments } from "@/components/admin/payments";
import { Errors } from "@/components/admin/errors";
import { Feedback } from "@/components/admin/feedback";
import { AppSettings } from "@/components/admin/app-settings";
import { Reviews } from "@/components/admin/reviews";
import { TypedConfirm } from "@/components/typed-confirm";
import { ColorGlow } from "@/components/color-glow";
import { PasswordField } from "@/components/password-field";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader, LoaderBlock } from "@/components/loader";
import { ConfirmProvider, useConfirm } from "@/components/admin/confirm";
import { DaysPicker, SelectMenu, type Option } from "@/components/admin/select-menu";
import {
  adminMe, adminPendingCounts, adminLogin, adminLogout, adminStats, adminOverview, adminMarketAnalytics, adminListListings, adminListingAction,
  adminListAgencies, adminAgencyAction, adminListUsers, adminListComments, adminRemoveComment, adminSetUserBlocked, adminDeleteUser, adminResetUserPassword, adminBulkListingAction, adminExportCsv, adminSearchReport, adminSecurity, adminUpdateSettings, adminRevokeSession,
  adminListTeam, adminActivityLog, adminCreateEditor, adminUpdateTeamMember, adminUpdateMyAccount, adminBegin2fa, adminConfirm2fa, adminDisable2fa, adminNewBackupCodes, adminReset2fa,
} from "@/lib/admin.functions";
import { gaIdQuery } from "@/lib/analytics.functions";
import { matchesQuery, withinDays } from "@/lib/admin-filters";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — Hodii" },
      { name: "description", content: "Hodii site administration." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin — Hodii" },
      { property: "og:description", content: "Hodii site administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ConfirmProvider><AdminPage /></ConfirmProvider>,
});

type Me = NonNullable<Awaited<ReturnType<typeof adminMe>>>;
const err = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");
const fmtDay = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

function Shell({ children }: { children: ReactNode }) {
  return <div className="admin-shell aurora relative min-h-screen overflow-x-hidden"><ColorGlow />{children}</div>;
}

function AdminPage() {
  const me = useQuery({ queryKey: ["admin", "me"], queryFn: () => adminMe() });
  if (me.isLoading) return <Shell><LoaderBlock className="min-h-screen" size="lg" label="Opening admin" /></Shell>;
  return me.data ? <Dashboard me={me.data} /> : <Login />;
}

function Login() {
  const qc = useQueryClient();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const m = useMutation({
    mutationFn: () => adminLogin({ data: { login, password, ...(needsCode && code.trim() ? { code: code.trim() } : {}) } }),
    onSuccess: (r) => { if (r.ok) { qc.invalidateQueries({ queryKey: ["admin"] }); return; } if ("needsCode" in r && r.needsCode) setNeedsCode(true); setError(r.error || null); },
    onError: (e) => setError(e instanceof Error ? e.message : "Something went wrong"),
  });
  return (
    <Shell>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pt-32 pb-24">
        <a href="/" className="auth-page-title">Hodii</a>
        <div className="glass-strong rounded-[2rem] p-6 shadow-float md:p-8">
          <h1 className="text-center font-serif text-4xl">Admin sign in</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">Use your username or email to manage Hodii.</p>
          <form noValidate className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); setError(null); if (!login || !password) { setError("Enter your username or email and password."); return; } if (needsCode && !code.trim()) { setError("Enter the code from your app."); return; } m.mutate(); }}>
            <div>
              <label htmlFor="admin-login" className="auth-label">Username or email</label>
              <input id="admin-login" className="auth-input" placeholder="admin" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
            </div>
            <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
            {needsCode && (
              <div>
                <label htmlFor="admin-code" className="auth-label">Code from your authenticator app</label>
                <input id="admin-code" className="auth-input" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="6-digit code, or a backup code" value={code} onChange={(e) => setCode(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Lost your phone? Use one of your backup codes.</p>
              </div>
            )}
            {error && <p role="alert" className="auth-banner">{error}</p>}
            <button type="submit" disabled={m.isPending} className="admin-btn h-12 text-base" data-tone="primary">{m.isPending ? <><Loader size="xs" /> Signing in</> : "Sign in"}</button>
          </form>
        </div>
      </main>
    </Shell>
  );
}

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, role: "editor" },
  { id: "analytics", label: "Analytics", icon: BarChart3, role: "editor" },
  { id: "moderation", label: "Moderation", icon: ShieldAlert, role: "editor" },
  { id: "listings", label: "Listings", icon: Building2, role: "editor" },
  { id: "comments", label: "Comments", icon: MessageSquare, role: "editor" },
  { id: "reviews", label: "Reviews", icon: Star, role: "editor" },
  { id: "payments", label: "Payments", icon: Star, role: "admin" },
  { id: "agencies", label: "Agencies", icon: Briefcase, role: "admin" },
  { id: "users", label: "Users", icon: Users, role: "admin" },
  { id: "site", label: "Site & security", icon: ShieldCheck, role: "admin" },
  { id: "settings", label: "Settings", icon: SlidersHorizontal, role: "admin" },
  { id: "feedback", label: "Feedback", icon: MessageSquare, role: "editor" },
  { id: "errors", label: "Errors", icon: ShieldAlert, role: "admin" },
  { id: "activity", label: "Activity", icon: Activity_, role: "admin" },
  { id: "team", label: "Team", icon: UsersRound, role: "admin" },
  { id: "account", label: "My account", icon: UserCog, role: "editor" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Dashboard({ me }: { me: Me }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>(me.twoFactorRequired && !me.twoFactor ? "account" : "overview");
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const logout = useMutation({ mutationFn: () => adminLogout(), onSuccess: () => { qc.clear(); location.reload(); } });
  const mustSetUp2fa = me.twoFactorRequired && !me.twoFactor;
  const tabs = TABS.filter((t) => (t.role === "editor" || me.role === "admin") && (!mustSetUp2fa || t.id === "account"));
  const current = tabs.find((t) => t.id === tab);
  useEffect(() => { document.body.style.overflow = drawer ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [drawer]);
  const go = (id: Tab) => { setTab(id); setDrawer(false); window.scrollTo({ top: 0 }); };
  const signOut = async () => { if (await confirm({ title: "Sign out of admin?", confirmLabel: "Sign out" })) logout.mutate(); };

  const pending = useQuery({ queryKey: ["admin", "pending"], queryFn: () => adminPendingCounts(), refetchInterval: 30_000, refetchOnWindowFocus: true });
  const waiting = pending.data ? pending.data.listings + pending.data.agencies + pending.data.reports : 0;
  useEffect(() => { document.title = waiting ? `(${waiting}) Admin — Hodii` : "Admin — Hodii"; }, [waiting]);
  const nav = (rail: boolean) => (
    <>
      <div className="mb-5 flex min-w-0 items-center gap-3 px-1">
        <span className="avatar-orb h-10 w-10 shrink-0 text-sm" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{me.username.slice(0, 1).toUpperCase()}</span>
        <div className="admin-label min-w-0">
          <a href="/" className="block font-serif text-xl leading-tight">Hodii</a>
          <p className="truncate text-xs text-muted-foreground">{me.username} · {me.role === "admin" ? "Admin" : "Editor"}</p>
        </div>
      </div>
      <nav className="admin-nav space-y-1">
        {tabs.map((t) => (
          <button key={t.id} type="button" className="admin-tab" data-active={tab === t.id} title={rail ? t.label : undefined} aria-label={t.label} onClick={() => go(t.id)}>
            <t.icon /><span className="admin-label">{t.label}</span>
            {t.id === "moderation" && waiting > 0 && <span className="ml-auto grid min-w-[1.25rem] place-items-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold leading-5 text-primary-foreground" aria-label={`${waiting} waiting`}>{waiting > 99 ? "99+" : waiting}</span>}
          </button>
        ))}
      </nav>
      <div className="mt-3 space-y-1 border-t border-border/60 pt-3">
        {rail && (
          <button type="button" className="admin-tab hidden lg:flex" title={collapsed ? "Expand menu" : undefined} aria-label={collapsed ? "Expand menu" : "Collapse menu"} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}<span className="admin-label">Collapse menu</span>
          </button>
        )}
        <button type="button" className="admin-tab" title={rail ? "Sign out" : undefined} aria-label="Sign out" onClick={signOut}>
          <LogOut /><span className="admin-label">Sign out</span>
        </button>
      </div>
    </>
  );

  return (
    <Shell>
      <header className="admin-topbar glass-strong shadow-float">
        <button type="button" className="admin-icon-btn" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu className="h-5 w-5" /></button>
        <p className="truncate text-center font-serif text-lg">{current?.label}</p>
        <span className="avatar-orb h-10 w-10 text-sm" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{me.username.slice(0, 1).toUpperCase()}</span>
      </header>
      {drawer && (
        <>
          <div className="admin-overlay" onClick={() => setDrawer(false)} />
          <aside className="admin-drawer glass-strong shadow-float admin-enter" aria-label="Admin menu">
            <button type="button" className="admin-icon-btn absolute top-3 right-3" aria-label="Close menu" onClick={() => setDrawer(false)}><X className="h-5 w-5" /></button>
            {nav(false)}
          </aside>
        </>
      )}
      <aside className="admin-sidebar glass-strong shadow-float" data-collapsed={collapsed}>{nav(true)}</aside>
      <main key={tab} className="admin-main admin-enter mx-auto w-full max-w-[90rem] space-y-6" data-collapsed={collapsed}>
        {tab === "overview" && <Overview />}
        {tab === "analytics" && <Analytics />}
        {tab === "moderation" && <Moderation isAdmin={me.role === "admin"} />}
        {tab === "listings" && <Listings />}
        {tab === "comments" && <Comments />}
        {tab === "reviews" && <Reviews />}
        {tab === "agencies" && <Agencies />}
        {tab === "payments" && <Payments />}
        {tab === "errors" && <Errors />}
        {tab === "feedback" && <Feedback />}
        {tab === "settings" && <><H sub="Prices, limits, AI quotas and ranking. Changes reach the site within about 30 seconds.">Settings</H><AppSettings /></>}
        {tab === "users" && <Users_ />}
        {tab === "site" && <SiteSecurity />}
        {tab === "activity" && <Activity />}
        {tab === "team" && <Team meId={me.id} />}
        {tab === "account" && <Account me={me} />}
      </main>
    </Shell>
  );
}

/* ---------- Shared pieces ---------- */

type PageOf<T> = { rows: T[]; total: number; nextOffset: number | null };
/** Loads a list 20 at a time; the next batch arrives as the admin scrolls near the end. */
function usePaged<P extends PageOf<unknown>>(key: unknown[], fetchPage: (offset: number) => Promise<P>) {
  const q = useInfiniteQuery({
    queryKey: key, initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
  const pages = q.data?.pages ?? [];
  return { q, first: pages[0] as P | undefined, rows: pages.flatMap((p) => p.rows) as P["rows"], total: pages[0]?.total ?? 0 };
}
function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = window.setTimeout(() => setV(value), ms); return () => window.clearTimeout(t); }, [value, ms]);
  return v;
}
function MoreSentinel({ q }: { q: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown } }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !q.hasNextPage) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting && !q.isFetchingNextPage) q.fetchNextPage(); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q]);
  if (!q.hasNextPage) return null;
  return <div ref={ref} className="flex justify-center py-4">{q.isFetchingNextPage ? <Loader /> : <button type="button" className="admin-btn" onClick={() => q.fetchNextPage()}>Load more</button>}</div>;
}

function ExportButton({ kind }: { kind: "listings" | "agencies" | "users" | "payments" }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const text = await adminExportCsv({ data: { kind } });
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `hodii-${kind}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not export"); } finally { setBusy(false); }
  };
  return <button className="admin-btn" disabled={busy} onClick={go}>{busy ? "Preparing…" : "Export CSV"}</button>;
}

const H = ({ children, sub, right }: { children: ReactNode; sub?: string | undefined; right?: ReactNode }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0"><h1 className="admin-title">{children}</h1>{sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}</div>
    {right && <div className="flex shrink-0 flex-wrap gap-2">{right}</div>}
  </div>
);
const Stat = ({ label, value, glow }: { label: string; value: ReactNode; glow?: string }) => (
  <div className="admin-card admin-hover admin-stat-card relative" style={glow ? { ["--stat-glow" as string]: glow } : undefined}>
    <p className="admin-stat-label">{label}</p><p className="admin-stat">{value ?? "—"}</p>
  </div>
);
function State({ q, empty, children }: { q: { isLoading: boolean; error: unknown }; empty?: ReactNode | false; children?: ReactNode }) {
  if (q.isLoading) return <LoaderBlock />;
  if (q.error) return <div className="admin-empty text-destructive">{(q.error as Error).message}</div>;
  if (empty) return <div className="admin-empty text-muted-foreground">{empty}</div>;
  return <>{children}</>;
}
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="admin-search">
      <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button type="button" aria-label="Clear search" onClick={() => onChange("")}><X className="h-4 w-4 text-muted-foreground" /></button>}
    </label>
  );
}
function Check3({ state, onClick, label }: { state: "on" | "off" | "some"; onClick: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={state === "some" ? "mixed" : state === "on"} aria-label={label} className="admin-check" data-state={state} onClick={onClick}>
      {state === "on" ? <Check /> : state === "some" ? <Minus /> : null}
    </button>
  );
}

/** Selection for bulk actions over the currently visible ids. */
function useSelection(visible: string[]) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const picked = visible.filter((id) => sel.has(id));
  const all: "on" | "off" | "some" = picked.length === 0 ? "off" : picked.length === visible.length ? "on" : "some";
  return {
    picked, all,
    has: (id: string) => sel.has(id),
    toggle: (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    toggleAll: () => setSel(all === "on" ? new Set() : new Set(visible)),
    clear: () => setSel(new Set()),
  };
}
function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (!count) return null;
  return (
    <div className="admin-bulk glass-strong shadow-float">
      <span className="px-2 text-sm font-bold">{count} selected</span>
      <div className="flex flex-1 flex-wrap justify-end gap-2">{children}<button type="button" className="admin-btn" onClick={onClear}>Clear</button></div>
    </div>
  );
}
function SelectAllRow({ s, total }: { s: ReturnType<typeof useSelection>; total: number }) {
  if (!total) return null;
  return <div className="flex items-center gap-3 px-1 text-sm text-muted-foreground"><Check3 state={s.all} onClick={s.toggleAll} label="Select all shown" /> Select all {total} shown</div>;
}
async function runAll<T>(items: T[], fn: (x: T) => Promise<unknown>) {
  const res = await Promise.allSettled(items.map(fn));
  const failed = res.filter((r) => r.status === "rejected").length;
  if (failed) toast.error(`${failed} of ${items.length} could not be updated`);
  else toast.success(`${items.length} updated`);
}
const opts = <T extends string>(all: string, values: T[]): Option<T | "all">[] => [{ value: "all", label: all }, ...values.map((v) => ({ value: v, label: v }))];

/* ---------- Overview & analytics ---------- */

function ViewsChart({ daily }: { daily: { day: string; views: number; visitors: number }[] }) {
  return (
    <div className="admin-card h-72 min-w-0">
      <p className="mb-2 text-sm font-semibold">Daily views and visitors</p>
      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={daily}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="day" fontSize={11} stroke="var(--muted-foreground)" />
          <YAxis fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} width={32} />
          <Tooltip />
          <Area dataKey="views" stroke="var(--foreground)" strokeWidth={2} fill="none" />
          <Area dataKey="visitors" stroke="var(--muted-foreground)" strokeWidth={2} strokeDasharray="5 4" fill="none" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: { label: string; value: number; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="admin-card min-w-0">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No visits yet.</p>}
      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex justify-between gap-2 text-sm"><span className="min-w-0 truncate">{r.label}</span><span className="shrink-0 tabular-nums">{r.value}{r.sub ? ` · ${r.sub}` : ""}</span></div>
            <div className="admin-bar-track mt-1.5"><div className="admin-bar" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Overview ---------- */

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

function Overview() {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: () => adminOverview(), refetchInterval: 30_000 });
  if (!q.data) return <><H>Overview</H><State q={q} /></>;
  const { stats, settings, failedLogins24h, platform: p } = q.data;
  return (
    <>
      <H sub="Last 30 days">Overview</H>
      {settings.maintenance_mode && <div className="admin-card flex flex-wrap items-center gap-2"><span className="admin-badge" data-tone="warn">Site paused</span> Visitors currently see the maintenance message.</div>}
      {(p.pendingListings > 0 || p.openReports > 0 || (p.agencies["pending"] ?? 0) > 0) && (
        <div className="admin-card flex flex-wrap items-center gap-x-6 gap-y-2" role="note">
          <span className="admin-badge" data-tone="warn">Needs attention</span>
          {p.pendingListings > 0 && <span>{p.pendingListings} listings waiting for review</span>}
          {(p.agencies["pending"] ?? 0) > 0 && <span>{p.agencies["pending"]} agencies waiting for verification</span>}
          {p.openReports > 0 && <span>{p.openReports} open reports</span>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <Stat label="Live listings" value={p.listings["published"] ?? 0} glow="var(--glow-pink)" />
        <Stat label="Agencies (verified)" value={`${Object.values(p.agencies).reduce((a, b) => a + b, 0)} (${p.agencies["verified"] ?? 0})`} />
        <Stat label="Accounts (new this week)" value={`${p.users} (${p.newUsers})`} />
        <Stat label="Enquiry response rate" value={p.responseRate === null ? "—" : `${p.responseRate}%`} />
        <Stat label="Listing views" value={p.last30.views} />
        <Stat label="Enquiries" value={p.last30.enquiries} />
        <Stat label="Phone reveals" value={p.last30.phoneReveals} />
        <Stat label="Saves" value={p.last30.saves} />
        <Stat label="Site visitors" value={stats.visitors} />
        <Stat label="Site page views" value={stats.views} />
        <Stat label="Views today" value={stats.today} />
        <Stat label="Failed admin logins, 24h" value={failedLogins24h} />
      </div>
      <ViewsChart daily={stats.daily} />
    </>
  );
}

function SeriesChart({ series }: { series: { day: string; views: number; visitors: number; enquiries: number }[] }) {
  return (
    <div className="admin-card h-72 min-w-0">
      <p className="mb-2 text-sm font-semibold">Listing views, visitors and enquiries per day</p>
      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={series}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="day" fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(d: string) => d.slice(5)} />
          <YAxis fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} width={32} />
          <Tooltip />
          <Area dataKey="views" name="Views" stroke="var(--foreground)" strokeWidth={2} fill="none" />
          <Area dataKey="visitors" name="Unique viewers" stroke="var(--muted-foreground)" strokeWidth={2} strokeDasharray="5 4" fill="none" />
          <Area dataKey="enquiries" name="Enquiries" stroke="var(--primary)" strokeWidth={2} fill="none" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Analytics() {
  const [days, setDays] = useState<number | null>(30);
  const d = Math.max(7, days ?? 30);
  const m = useQuery({ queryKey: ["admin", "market", d], queryFn: () => adminMarketAnalytics({ data: { days: d } }) });
  const t = useQuery({ queryKey: ["admin", "stats", d], queryFn: () => adminStats({ data: { days: d } }) });
  const sr = useQuery({ queryKey: ["admin", "searches", d], queryFn: () => adminSearchReport({ data: { days: Math.min(d, 120) } }) });
  const GA_ID = useQuery(gaIdQuery).data?.gaId;
  const f = m.data?.funnel;
  return (
    <>
      <H sub={GA_ID ? `Google Analytics is also collecting (${GA_ID}).` : "Google Analytics turns on once a measurement ID is added."} right={<DaysPicker value={days} onChange={setDays} align="end" />}>Analytics</H>
      <p className="admin-stat-label">Buyer and tenant activity</p>
      <State q={m}>
        {m.data && f && (
          <>
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
              <Stat label="Listing views" value={f.views} />
              <Stat label="Saves" value={`${f.saves} (${pct(f.saves, f.views)})`} />
              <Stat label="Contact clicks (call, WhatsApp)" value={`${f.phoneReveals} (${pct(f.phoneReveals, f.views)})`} />
              <Stat label="Enquiries" value={`${f.enquiries} (${pct(f.enquiries, f.views)})`} />
            </div>
            <SeriesChart series={m.data.series} />
            <div className="grid gap-4 lg:grid-cols-2">
              <BarList title="Most viewed listings" rows={m.data.topListings} />
              <BarList title="Agencies by enquiries" rows={m.data.topAgencies} />
              <BarList title="Counties by views" rows={m.data.byCounty} />
              <BarList title="Views by listing type" rows={m.data.byType} />
              <BarList title="Live listings by type and category" rows={m.data.supply} />
            </div>
          </>
        )}
      </State>
      <p className="admin-stat-label">What people search for</p>
      <State q={sr}>
        {sr.data && (
          <>
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-3"><Stat label="Searches with words" value={sr.data.total} /><Stat label="Found nothing" value={sr.data.zero} /><Stat label="Share with no result" value={`${sr.data.zeroPct}%`} /></div>
            <div className="grid gap-4 lg:grid-cols-2">
              <BarList title="Top searches" rows={sr.data.top.map((r) => ({ label: r.term, value: r.searches }))} />
              <BarList title="Searches that found nothing (what to add or fix)" rows={sr.data.noResults.map((r) => ({ label: r.term, value: r.zero, sub: `of ${r.searches}` }))} />
            </div>
          </>
        )}
      </State>
      <p className="admin-stat-label">Website traffic</p>
      <State q={t}>
        {t.data && (
          <>
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-3"><Stat label="Page views" value={t.data.views} /><Stat label="Visitors" value={t.data.visitors} /><Stat label="Today" value={t.data.today} /></div>
            <div className="grid gap-4 lg:grid-cols-2">
              <BarList title="Pages" rows={t.data.paths.map((p) => ({ label: p.path, value: p.views, sub: `${p.visitors} people` }))} />
              <BarList title="Where visitors came from" rows={t.data.referrers.map((r) => ({ label: r.referrer, value: r.views }))} />
              <BarList title="Devices" rows={t.data.devices.map((x) => ({ label: x.device, value: x.views }))} />
              <BarList title="Hour of day (UTC)" rows={t.data.hours.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00`, value: h.views }))} />
            </div>
          </>
        )}
      </State>
    </>
  );
}

/* ---------- Listings, agencies, users ---------- */

const money = (s: string) => s;
const LISTING_STATUS = ["all", "published", "pending_review", "paused", "draft", "expired", "rejected", "closed"] as const;

function Listings() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof LISTING_STATUS)[number]>("published");
  const dq = useDebounced(query);
  const f = { q: dq, status };
  const { q, first, rows, total } = usePaged(["admin", "listings", f], (offset) => adminListListings({ data: { ...f, offset } }));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const bulk = useMutation({
    mutationFn: (v: { action: "pause" | "resume" | "feature" | "unfeature" | "delete"; confirmText?: string; password?: string }) => adminBulkListingAction({ data: { ids: [...picked], ...v } }),
    onSuccess: (r) => { toast.success(`${r.done} done${r.skipped.length ? `, ${r.skipped.length} skipped: ${r.skipped[0]!.reason}` : ""}`); setPicked(new Set()); setDeleting(false); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e, v) => { const m = e instanceof Error ? e.message : "Could not complete that"; if (v.action === "delete") setDelError(m); else toast.error(m); },
  });
  const act = useMutation({ mutationFn: (v: { id: string; action: "pause" | "resume" | "feature" | "unfeature" }) => adminListingAction({ data: v }), onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["admin", "listings"] }); }, onError: err });
  return (
    <>
      <H sub={first ? `${rows.length} of ${total} listings shown` : undefined} right={<ExportButton kind="listings" />}>Listings</H>
      {picked.size > 0 && (
        <div role="region" aria-label="Actions for selected listings" className="admin-card sticky top-2 z-10 mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">{picked.size} selected</span>
          {(["pause", "resume", "feature", "unfeature"] as const).map((a) => { const label = { pause: "Pause", resume: "Resume", feature: "Boost free 30 days", unfeature: "Remove boost" }[a]; return <button key={a} className="admin-btn" disabled={bulk.isPending} onClick={async () => { if (await confirm({ title: `${label} for ${picked.size} listings?`, confirmLabel: label })) bulk.mutate({ action: a }); }}>{label}</button>; })}
          <button className="admin-btn" data-tone="danger" onClick={() => { setDelError(null); setDeleting(true); }}>Delete…</button>
          <button className="ml-auto text-xs font-bold underline" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}
      <TypedConfirm open={deleting} busy={bulk.isPending} error={delError} onClose={() => setDeleting(false)} title={`Delete ${picked.size} listings?`}
        body="They are removed for good, whatever their status, along with saves. Pausing hides a listing without losing it. Consider that first." phrase={`DELETE ${picked.size}`} needPassword
        onConfirm={({ text, password }) => bulk.mutate({ action: "delete", confirmText: text, password })} />
      <div className="admin-filters">
        <SearchBox value={query} onChange={setQuery} placeholder="Search title, reference or area" />
        <SelectMenu prefix="Status" value={status} onChange={setStatus} options={LISTING_STATUS.map((s) => ({ value: s, label: s === "all" ? "All" : s === "pending_review" ? "In review" : s[0]!.toUpperCase() + s.slice(1) }))} />
      </div>
      <State q={q} empty={first && rows.length === 0 ? "No listings match." : false}>
        <div className="space-y-2">
          {rows.map((l) => (
            <div key={l.id} className="admin-card admin-row flex flex-wrap items-center justify-between gap-3">
              <input type="checkbox" aria-label={`Select ${l.title}`} className="size-4 shrink-0" checked={picked.has(l.id)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.title}</p>
                <p className="text-xs text-muted-foreground">{l.agency} · {money(l.price)} · {l.county} · ref {l.ref}</p>
                <p className="mt-1 flex flex-wrap gap-2 text-xs"><span className="admin-badge">{l.status.replace("_", " ")}</span>{l.tier !== "none" && <span className="admin-badge" data-tone="warn">{l.tier === "premium" ? "Premium" : "Boosted"}</span>}<span className="text-muted-foreground">{l.views} views · {l.enquiries} enquiries</span></p>
              </div>
              <div className="flex flex-wrap gap-2">
                {l.status === "published" && <a className="admin-btn" href={`/property/${l.slug}`} target="_blank" rel="noopener">View</a>}
                {l.status === "published" && (l.tier === "boost" ? <button className="admin-btn" onClick={() => act.mutate({ id: l.id, action: "unfeature" })}>Remove boost</button> : l.tier === "none" ? <button className="admin-btn" onClick={() => act.mutate({ id: l.id, action: "feature" })}>Boost free 30 days</button> : null)}
                {l.status === "published" && <button className="admin-btn" data-tone="danger" onClick={async () => { if (await confirm({ title: "Pause this listing?", body: "It disappears from the site until it is resumed.", confirmLabel: "Pause", tone: "danger" })) act.mutate({ id: l.id, action: "pause" }); }}>Pause</button>}
                {l.status === "paused" && <button className="admin-btn" onClick={() => act.mutate({ id: l.id, action: "resume" })}>Resume</button>}
              </div>
            </div>
          ))}
        </div>
        <MoreSentinel q={q} />
      </State>
    </>
  );
}

const COMMENT_KINDS = ["all", "comment", "reply"] as const;

function Comments() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof COMMENT_KINDS)[number]>("all");
  const dq = useDebounced(query);
  const f = { q: dq, kind };
  const { q, first, rows, total } = usePaged(["admin", "comments", f], (offset) => adminListComments({ data: { ...f, offset } }));
  const del = useMutation({ mutationFn: (id: string) => adminRemoveComment({ data: { id } }), onSuccess: () => { toast.success("Comment removed"); qc.invalidateQueries({ queryKey: ["admin", "comments"] }); }, onError: err });
  return (
    <>
      <H sub={first ? `${rows.length} of ${total} comments shown` : undefined}>Comments</H>
      <div className="admin-filters">
        <SearchBox value={query} onChange={setQuery} placeholder="Search by person or listing title" />
        <SelectMenu prefix="Show" value={kind} onChange={setKind} options={COMMENT_KINDS.map((s) => ({ value: s, label: s === "all" ? "Comments and replies" : s === "comment" ? "Comments" : "Replies" }))} />
      </div>
      <State q={q} empty={first && rows.length === 0 ? "No comments yet." : false}>
        <div className="space-y-2">
          {rows.map((c) => (
            <div key={c.id} className="admin-card admin-row flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{c.author} · {c.isReply ? "reply" : "comment"} · {c.createdAt.slice(0, 16).replace("T", " ")}{c.listing && <> · <a className="underline" href={`/property/${c.listing.slug}#comments`} target="_blank" rel="noopener">{c.listing.title}</a></>}</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{c.text}</p>
              </div>
              <button className="admin-btn" data-tone="danger" onClick={async () => { if (await confirm({ title: "Remove this comment?", body: "It disappears from the listing for everyone. The person is not told.", confirmLabel: "Remove", tone: "danger" })) del.mutate(c.id); }}>Remove</button>
            </div>
          ))}
        </div>
        <MoreSentinel q={q} />
      </State>
    </>
  );
}

const AGENCY_STATUS = ["all", "pending", "verified", "unverified", "rejected", "suspended"] as const;

function Agencies() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof AGENCY_STATUS)[number]>("all");
  const dq = useDebounced(query);
  const f = { q: dq, status };
  const { q, first, rows, total } = usePaged(["admin", "agencies", f], (offset) => adminListAgencies({ data: { ...f, offset } }));
  const act = useMutation({ mutationFn: (v: { id: string; action: "suspend" | "reinstate"; reason?: string }) => adminAgencyAction({ data: v }), onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["admin", "agencies"] }); }, onError: err });
  return (
    <>
      <H sub={first ? `${rows.length} of ${total} agencies shown` : undefined}right={<ExportButton kind="agencies" />}>Agencies</H>
      <div className="admin-filters">
        <SearchBox value={query} onChange={setQuery} placeholder="Search agency name" />
        <SelectMenu prefix="Status" value={status} onChange={setStatus} options={AGENCY_STATUS.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))} />
      </div>
      <State q={q} empty={first && rows.length === 0 ? "No agencies match." : false}>
        <div className="space-y-2">
          {rows.map((a) => (
            <div key={a.id} className="admin-card admin-row flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.kind.replace("_", " ")} · {a.liveListings} live listings{a.pendingListings > 0 ? ` · ${a.pendingListings} awaiting review` : ""} · {a.team} {a.team === 1 ? "member" : "members"}</p>
                <p className="mt-1 flex flex-wrap gap-2 text-xs"><span className="admin-badge" data-tone={a.verification === "verified" ? undefined : "warn"}>{a.verification}</span>{a.suspended && <span className="admin-badge" data-tone="danger">Suspended</span>}{a.suspendedReason && <span className="text-muted-foreground">{a.suspendedReason}</span>}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a className="admin-btn" href={`/agency/${a.slug}`} target="_blank" rel="noopener">View</a>
                {a.suspended ? <button className="admin-btn" onClick={() => act.mutate({ id: a.id, action: "reinstate" })}>Reinstate</button>
                  : <button className="admin-btn" data-tone="danger" onClick={() => { const reason = window.prompt("Why is this agency being suspended? The reason is kept on record. Its live listings are taken down at once."); if (reason && reason.trim().length >= 5) act.mutate({ id: a.id, action: "suspend", reason: reason.trim() }); else if (reason !== null) toast.error("Write a short reason"); }}>Suspend</button>}
              </div>
            </div>
          ))}
        </div>
        <MoreSentinel q={q} />
      </State>
      <span hidden>{String(!!confirm)}</span>
    </>
  );
}

const USER_TYPES = ["all", "user", "agency", "blocked"] as const;

function Users_() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<(typeof USER_TYPES)[number]>("all");
  const dq = useDebounced(query);
  const f = { q: dq, type };
  const { q, first, rows, total } = usePaged(["admin", "users", f], (offset) => adminListUsers({ data: { ...f, offset } }));
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });
  const block = useMutation({ mutationFn: (v: { id: string; blocked: boolean }) => adminSetUserBlocked({ data: v }), onSuccess: refresh, onError: err });
  const reset = useMutation({ mutationFn: (id: string) => adminResetUserPassword({ data: { id } }), onError: err });
  const del = useMutation({ mutationFn: (id: string) => adminDeleteUser({ data: { id } }), onSuccess: () => { toast.success("Account deleted"); refresh(); }, onError: err });
  return (
    <>
      <H sub={first ? `${rows.length} of ${total} accounts shown` : undefined}right={<ExportButton kind="users" />}>Users</H>
      <div className="admin-filters">
        <SearchBox value={query} onChange={setQuery} placeholder="Search username" />
        <SelectMenu prefix="Type" value={type} onChange={setType} options={USER_TYPES.map((s) => ({ value: s, label: s === "user" ? "Property seekers" : s === "agency" ? "Agency accounts" : s[0]!.toUpperCase() + s.slice(1) }))} />
      </div>
      <State q={q} empty={first && rows.length === 0 ? "No accounts match." : false}>
        <div className="space-y-2">
          {rows.map((u) => (
            <div key={u.id} className="admin-card admin-row flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{u.username} {u.blocked && <span className="admin-badge" data-tone="danger">Blocked</span>}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email} · joined {u.createdAt?.slice(0, 10)}</p>
                <p className="text-xs text-muted-foreground">{u.agencies} {u.agencies === 1 ? "agency" : "agencies"} · {u.saved} saved · {u.enquiries} enquiries sent</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="admin-btn" onClick={async () => { if (!(await confirm({ title: `Reset password for ${u.username}?`, body: "Only do this after you are sure the person asking owns the account. They are signed out everywhere, and you get a temporary password to pass on once.", confirmLabel: "Reset password", tone: "danger" }))) return; const r = await reset.mutateAsync(u.id).catch(() => null); if (r) window.prompt("Temporary password (copy it now, it is not shown again). Tell the person to change it right away.", r.password); }}>Reset password</button>
                <button className="admin-btn" onClick={() => block.mutate({ id: u.id, blocked: !u.blocked })}>{u.blocked ? "Unblock" : "Block"}</button>
                <button className="admin-btn" data-tone="danger" onClick={async () => { if (await confirm({ title: `Delete ${u.username}?`, body: "Their sign-in, saved properties and searches are removed. Enquiries they sent stay with the agencies, without their link to the account.", confirmLabel: "Delete", tone: "danger" })) del.mutate(u.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        <MoreSentinel q={q} />
      </State>
    </>
  );
}

function SiteSecurity() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ["admin", "security"], queryFn: () => adminSecurity() });
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "security"] });
  const upd = useMutation({ mutationFn: (s: { maintenance_mode: boolean; maintenance_message: string; signups_enabled: boolean; comments_enabled: boolean }) => adminUpdateSettings({ data: s }), onSuccess: () => { toast.success("Saved"); setMsg(null); refresh(); }, onError: err });
  const revoke = useMutation({ mutationFn: (id: string | null) => adminRevokeSession({ data: { id } }), onSuccess: () => { toast.success("Signed out"); refresh(); }, onError: err });
  if (!q.data) return <><H>Site & security</H><State q={q} /></>;
  const s = q.data.settings;

  const flip = async (k: "maintenance_mode" | "signups_enabled" | "comments_enabled", label: string) => {
    const on = !s[k];
    const serious = k === "maintenance_mode" && on;
    const ok = await confirm(serious
      ? { title: "Pause the whole site?", tone: "danger", confirmLabel: "Continue", twoStep: { title: "Visitors will only see the pause message", body: "Every page except this dashboard is hidden until you switch this off.", confirmLabel: "Pause site" } }
      : { title: `${on ? "Turn on" : "Turn off"}: ${label}?`, confirmLabel: on ? "Turn on" : "Turn off", tone: on ? "default" : "danger" });
    if (ok) upd.mutate({ ...s, [k]: on });
  };
  const setting = (k: "maintenance_mode" | "signups_enabled" | "comments_enabled", label: string, hint: string) => (
    <div className="admin-setting">
      <div className="min-w-0"><p className="font-semibold">{label}</p><p className="text-xs text-muted-foreground">{hint}</p></div>
      <Switch checked={s[k]} aria-label={label} onCheckedChange={() => flip(k, label)} />
    </div>
  );
  return (
    <>
      <H>Site & security</H>
      <div className="admin-card">
        {setting("maintenance_mode", "Pause the whole site", "Visitors see the message below instead of the site. This dashboard keeps working.")}
        {setting("signups_enabled", "Allow new sign-ups", "When off, nobody can create a new account.")}
        {setting("comments_enabled", "Allow comments", "When off, nobody can post new comments or replies.")}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <label className="admin-field-label" htmlFor="pause-msg">Pause message</label>
          <textarea id="pause-msg" className="admin-input" rows={2} value={msg ?? s.maintenance_message} onChange={(e) => setMsg(e.target.value)} />
          <button type="button" className="admin-btn" data-tone="primary" disabled={msg == null || upd.isPending}
            onClick={async () => { if (await confirm({ title: "Save the new pause message?", confirmLabel: "Save" })) upd.mutate({ ...s, maintenance_message: msg ?? s.maintenance_message }); }}>Save message</button>
        </div>
      </div>
      <div className="admin-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Signed-in admin devices</p>
          <button type="button" className="admin-btn" data-tone="danger" onClick={async () => { if (await confirm({ title: "Sign out every other device?", body: "Everyone else, including other team members, must sign in again.", tone: "danger", confirmLabel: "Sign them out" })) revoke.mutate(null); }}>Sign out all other devices</button></div>
        {q.data.sessions.map((x) => (
          <div key={x.id} className="admin-row glass flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1"><p className="font-semibold">{x.username}</p><p className="truncate text-xs text-muted-foreground">{x.device || "Unknown device"}</p>
              <div className="admin-meta"><span>Last active {fmt(x.lastSeen)}</span><span>Expires {fmt(x.expires)}</span></div></div>
            {x.id === q.data.currentSessionId ? <span className="admin-badge" data-tone="ok">This device</span>
              : <button type="button" className="admin-btn" onClick={async () => { if (await confirm({ title: `Sign out ${x.username} on this device?`, confirmLabel: "Sign out", tone: "danger" })) revoke.mutate(x.id); }}>Sign out</button>}
          </div>
        ))}
      </div>
    </>
  );
}

function AdminActivity({ title }: { title: string }) {
  const [query, setQuery] = useState("");
  const [days, setDays] = useState<number | null>(7);
  const [who, setWho] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const dq = useDebounced(query);
  const f = { q: dq, days, who, action };
  const { q, first, rows, total } = usePaged(["admin", "activity", "team", f], (offset) => adminActivityLog({ data: { ...f, offset } }));
  const [people, setPeople] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  useEffect(() => { if (first?.people) setPeople(first.people); if (first?.actions) setActions(first.actions); }, [first]);
  return (
    <div className="admin-card space-y-3">
      <p className="font-semibold">{title}{first ? <span className="ml-2 text-sm font-normal text-muted-foreground">{total} entries</span> : null}</p>
      <div className="admin-filters">
        <SearchBox value={query} onChange={setQuery} placeholder="Search person or action" />
        <DaysPicker value={days} onChange={setDays} allowAll />
        <SelectMenu prefix="Who" value={who} onChange={setWho} options={opts("Everyone", people)} />
        <SelectMenu prefix="Action" value={action} onChange={setAction} options={[{ value: "all", label: "All" }, ...actions.map((a) => ({ value: a, label: a.replace(/_/g, " ") }))]} />
      </div>
      <State q={q} empty={!!first && rows.length === 0 && "No activity matches these filters."}>
        <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
          {rows.map((l) => (
            <div key={l.id} className="admin-row glass flex flex-col gap-1">
              <div className="admin-meta"><span className="admin-badge" data-tone={l.action === "login_failed" ? "bad" : undefined}>{l.action.replace(/_/g, " ")}</span><span className="font-semibold text-foreground">{l.username ?? "—"}</span><span>{fmt(l.at)}</span><span className="font-mono">{l.network}</span></div>
              {l.detail !== "{}" && <p className="break-all text-xs text-muted-foreground">{l.detail}</p>}
            </div>
          ))}
          <MoreSentinel q={q} />
        </div>
      </State>
    </div>
  );
}

function Activity() {
  return (
    <>
      <H sub="What your team changed.">Activity</H>
      <AdminActivity title="Admin activity" />
    </>
  );
}


function Team({ meId }: { meId: string }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ["admin", "team"], queryFn: () => adminListTeam() });
  const [n, setN] = useState({ username: "", email: "", password: "" });
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | "admin" | "editor">("all");
  const [status, setStatus] = useState<"all" | "active" | "disabled">("all");
  const [days, setDays] = useState<number | null>(null);
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "team"] });
  const add = useMutation({ mutationFn: () => adminCreateEditor({ data: n }), onSuccess: () => { toast.success("Editor added"); setN({ username: "", email: "", password: "" }); setAdding(false); refresh(); }, onError: err });
  const upd = useMutation({ mutationFn: (v: { id: string; disabled?: boolean; remove?: boolean; password?: string }) => adminUpdateTeamMember({ data: v }), onSuccess: () => { toast.success("Updated"); refresh(); }, onError: err });
  const all = q.data ?? [];
  const others = all.filter((t) => t.id !== meId);
  const rows = others.filter((t) => matchesQuery([t.username, t.email], query) && (role === "all" || t.role === role) && (status === "all" || (status === "disabled") === t.disabled) && withinDays(t.last_login_at, days));
  const manageable = rows.filter((t) => t.role !== "admin");
  const sel = useSelection(manageable.map((t) => t.id));
  const bulk = async (kind: "disable" | "enable" | "remove") => {
    const k = sel.picked.length; const pl = k === 1 ? "" : "s";
    const ok = await confirm(kind === "remove"
      ? { title: `Remove ${k} team member${pl}?`, tone: "danger", confirmLabel: "Continue", twoStep: { title: "Remove them for good?", body: "They lose admin access immediately. This can’t be undone.", confirmLabel: "Remove" } }
      : { title: `${kind === "disable" ? "Disable" : "Enable"} ${k} team member${pl}?`, tone: kind === "disable" ? "danger" : "default", confirmLabel: kind === "disable" ? "Disable" : "Enable" });
    if (!ok) return;
    await runAll(sel.picked, (id) => adminUpdateTeamMember({ data: kind === "remove" ? { id, remove: true } : { id, disabled: kind === "disable" } }));
    sel.clear(); refresh();
  };
  return (
    <>
      <H sub="Editors can moderate listings and see analytics. Only admins change site settings, manage users and the team."
        right={<button type="button" className="admin-btn" data-tone="primary" onClick={() => setAdding(!adding)}>{adding ? "Close" : "Add team member"}</button>}>Team</H>
      {adding && (
        <form className="admin-card admin-enter grid gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]" onSubmit={async (e) => { e.preventDefault(); if (await confirm({ title: `Add ${n.username || "this person"} as an editor?`, body: "They can sign in to this dashboard straight away.", confirmLabel: "Add editor" })) add.mutate(); }}>
          <input className="admin-input" placeholder="Username" value={n.username} onChange={(e) => setN({ ...n, username: e.target.value })} />
          <input className="admin-input" placeholder="Email" type="email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} />
          <input className="admin-input" type="password" placeholder="Password (8+ characters)" value={n.password} onChange={(e) => setN({ ...n, password: e.target.value })} />
          <button className="admin-btn min-h-11" data-tone="primary" disabled={add.isPending}>Add editor</button>
        </form>
      )}
      {others.length > 0 && (
        <div className="admin-filters">
          <SearchBox value={query} onChange={setQuery} placeholder="Search name or email" />
          <SelectMenu prefix="Role" value={role} onChange={setRole} options={[{ value: "all", label: "Any" }, { value: "admin", label: "Admin" }, { value: "editor", label: "Editor" }]} />
          <SelectMenu prefix="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "Any" }, { value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }]} />
          <DaysPicker value={days} onChange={setDays} allowAll prefix="Signed in" />
        </div>
      )}
      <State q={q} empty={q.data && (others.length === 0
        ? <><UsersRound className="h-8 w-8" /><p className="font-semibold text-foreground">No team members yet.</p><p>Add new ones with “Add team member”.</p></>
        : rows.length === 0 && "No team members match these filters.")}>
        <SelectAllRow s={sel} total={manageable.length} />
        <div className="space-y-3">
          {rows.map((t) => (
            <div key={t.id} className="admin-row glass admin-hover space-y-3" data-selected={sel.has(t.id)}>
              <div className="flex flex-wrap items-center gap-3">
                {t.role !== "admin" ? <Check3 state={sel.has(t.id) ? "on" : "off"} onClick={() => sel.toggle(t.id)} label={`Select ${t.username}`} /> : <span className="w-[1.3rem]" />}
                <span className="avatar-orb h-10 w-10 shrink-0 text-sm" style={{ background: "var(--primary)" }}>{t.username.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.username}</p>
                  <div className="admin-meta"><span className="min-w-0 truncate">{t.email}</span><span>{t.role}</span><span>last sign-in {fmt(t.last_login_at)}</span></div>
                </div>
                <span className="admin-badge" data-tone={t.disabled ? "bad" : "ok"}>{t.disabled ? "Disabled" : "Active"}</span>
                {t.role !== "admin" && (
                  <div className="admin-row-actions w-full sm:w-auto">
                    <button type="button" className="admin-btn" onClick={async () => { if (await confirm({ title: `${t.disabled ? "Enable" : "Disable"} ${t.username}?`, tone: t.disabled ? "default" : "danger", confirmLabel: t.disabled ? "Enable" : "Disable" })) upd.mutate({ id: t.id, disabled: !t.disabled }); }}>{t.disabled ? "Enable" : "Disable"}</button>
                    <button type="button" className="admin-btn" onClick={() => { setPwFor(pwFor === t.id ? null : t.id); setNewPw(""); }}>Reset password</button>
                    {t.twoFactor && <button type="button" className="admin-btn" onClick={async () => { if (await confirm({ title: `Clear two-step sign-in for ${t.username}?`, body: "Do this only if they lost their phone and backup codes, and you are sure it is them. They can set it up again after signing in.", tone: "danger", confirmLabel: "Clear" })) { const r = await adminReset2fa({ data: { id: t.id } }); if (!r.ok) toast.error(r.error); else { toast.success("Cleared"); refresh(); } } }}>Reset two-step</button>}
                    <button type="button" className="admin-btn" data-tone="danger" onClick={async () => { if (await confirm({ title: `Remove ${t.username}?`, tone: "danger", confirmLabel: "Continue", twoStep: { title: "Remove for good?", body: "They lose admin access immediately. This can’t be undone.", confirmLabel: "Remove" } })) upd.mutate({ id: t.id, remove: true }); }}>Remove</button>
                  </div>
                )}
              </div>
              {pwFor === t.id && (
                <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (e) => { e.preventDefault(); if (newPw.length < 8) { toast.error("Use at least 8 characters"); return; } if (await confirm({ title: `Set a new password for ${t.username}?`, confirmLabel: "Set password" })) { upd.mutate({ id: t.id, password: newPw }); setPwFor(null); } }}>
                  <input className="admin-input" type="password" autoFocus placeholder="New password (8+ characters)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                  <button className="admin-btn min-h-11" data-tone="primary">Save password</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </State>
      <BulkBar count={sel.picked.length} onClear={sel.clear}>
        <button type="button" className="admin-btn" onClick={() => bulk("enable")}>Enable</button>
        <button type="button" className="admin-btn" onClick={() => bulk("disable")}>Disable</button>
        <button type="button" className="admin-btn" data-tone="danger" onClick={() => bulk("remove")}>Remove</button>
      </BulkBar>
      <AdminActivity title="Admin activity" />
    </>
  );
}

/* ---------- My account ---------- */

function Account({ me }: { me: Me }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [f, setF] = useState({ username: me.username, email: me.email, currentPassword: "", newPassword: "" });
  const m = useMutation({
    mutationFn: () => adminUpdateMyAccount({ data: { ...f, newPassword: f.newPassword || undefined } }),
    onSuccess: (r) => { if (!r.ok) { toast.error(r.error); return; } toast.success("Saved"); setF({ ...f, currentPassword: "", newPassword: "" }); qc.invalidateQueries({ queryKey: ["admin", "me"] }); },
    onError: err,
  });
  return (
    <>
      <H sub="Change your username, email or password at any time.">My account</H>
      <form className="admin-card max-w-xl space-y-4" onSubmit={async (e) => { e.preventDefault(); if (await confirm({ title: "Save changes to your account?", body: f.newPassword ? "You’ll use the new password next time you sign in." : undefined, confirmLabel: "Save" })) m.mutate(); }}>
        <label className="block"><span className="admin-field-label">Username</span><input className="admin-input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></label>
        <label className="block"><span className="admin-field-label">Email</span><input className="admin-input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="block"><span className="admin-field-label">New password</span><input className="admin-input" type="password" placeholder="Leave empty to keep" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></label>
        <label className="block"><span className="admin-field-label">Current password (required)</span><input className="admin-input" type="password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></label>
        <button className="admin-btn" data-tone="primary" disabled={m.isPending}>{m.isPending ? <><Loader size="xs" /> Saving</> : "Save changes"}</button>
      </form>
      <TwoStep me={me} />
    </>
  );
}

function TwoStep({ me }: { me: Me }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "me"] });
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [f, setF] = useState({ password: "", code: "" });
  const [codes, setCodes] = useState<string[] | null>(null);
  const begin = useMutation({ mutationFn: () => adminBegin2fa(), onSuccess: (r) => setSetup({ secret: r.secret, qr: r.qr }), onError: err });
  const done = (r: { ok: true; backupCodes?: string[] } | { ok: false; error: string }, msg: string) => {
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(msg); setSetup(null); setF({ password: "", code: "" }); if (r.backupCodes) setCodes(r.backupCodes); refresh();
  };
  const confirm2 = useMutation({ mutationFn: () => adminConfirm2fa({ data: f }), onSuccess: (r) => done(r, "Two-step sign-in is on"), onError: err });
  const off = useMutation({ mutationFn: () => adminDisable2fa({ data: f }), onSuccess: (r) => done(r, "Two-step sign-in is off"), onError: err });
  const renew = useMutation({ mutationFn: () => adminNewBackupCodes({ data: f }), onSuccess: (r) => done(r, "New backup codes made"), onError: err });
  return (
    <section className="admin-card mt-6 max-w-xl space-y-4" aria-labelledby="ts-h">
      <h2 id="ts-h" className="text-lg font-bold">Two-step sign-in</h2>
      {me.twoFactorRequired && !me.twoFactor && <p role="alert" className="auth-banner">This site requires two-step sign-in. Turn it on to use the rest of the admin area.</p>}
      {codes && (
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold">Backup codes. Save them somewhere safe: each works once, and they are shown only now.</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
          <button type="button" className="admin-btn mt-3" onClick={() => setCodes(null)}>I have saved them</button>
        </div>
      )}
      {!me.twoFactor ? (
        !setup ? (
          <>
            <p className="text-sm text-muted-foreground">Adds a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy and others) to your password.</p>
            <button type="button" className="admin-btn" data-tone="primary" disabled={begin.isPending} onClick={() => begin.mutate()}>Set up</button>
          </>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); confirm2.mutate(); }}>
            <p className="text-sm">1. Scan this with your authenticator app, or type the key by hand.</p>
            <img src={setup.qr} alt="QR code for your authenticator app" width={240} height={240} className="rounded-lg bg-white" />
            <p className="break-all font-mono text-sm">{setup.secret}</p>
            <p className="text-sm">2. Enter the 6-digit code it shows and your password.</p>
            <input className="admin-input" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
            <input className="admin-input" type="password" autoComplete="current-password" placeholder="Your password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <div className="flex gap-2"><button className="admin-btn" data-tone="primary" disabled={confirm2.isPending || !f.code || !f.password}>Turn on</button><button type="button" className="admin-btn" onClick={() => setSetup(null)}>Cancel</button></div>
          </form>
        )
      ) : (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <p className="text-sm text-muted-foreground">Two-step sign-in is on. To make new backup codes{me.twoFactorRequired ? "" : " or turn it off"}, enter your password and a current code.</p>
          <input className="admin-input" inputMode="numeric" autoComplete="one-time-code" placeholder="Current 6-digit code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
          <input className="admin-input" type="password" autoComplete="current-password" placeholder="Your password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="admin-btn" disabled={renew.isPending || !f.code || !f.password} onClick={() => renew.mutate()}>New backup codes</button>
            {!me.twoFactorRequired && <button type="button" className="admin-btn" data-tone="danger" disabled={off.isPending || !f.code || !f.password} onClick={() => off.mutate()}>Turn off</button>}
          </div>
        </form>
      )}
    </section>
  );
}
