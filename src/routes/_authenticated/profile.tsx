import { UserShell, CARD } from "@/components/dashboard/user-shell";
import { UploadingOverlay } from "@/components/dashboard/upload-ui";
import { absUrl } from "@/lib/site";
import { Loader } from "@/components/loader";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Heart, LogOut, MessageSquare, Reply, Search, ShieldCheck, ThumbsUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { changeEmail, changePassword, getSecurityStatus, regenerateRecoveryCodes } from "@/lib/signup.functions";
import { RecoveryCodes } from "@/components/recovery-codes";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PasswordField } from "@/components/password-field";
import { UserAvatar } from "@/components/account-button";
import { useAuth } from "@/hooks/use-auth";
import { AiAllowanceCard } from "@/components/property/ai-allowance";
import { uploadAvatar } from "@/components/dashboard/upload";
import { deleteMyAccount, exportMyData, setMyAvatar, getMyAccount, updateMyUsername } from "@/lib/account.functions";
import { deleteComment, getMyComments } from "@/lib/comments.functions";
import { LIMITS, passwordError, usernameSchema, type FormErrors, fieldError } from "@/lib/community-rules";

const accountQuery = queryOptions({ queryKey: ["me", "account"], queryFn: () => getMyAccount() });

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { property: "og:url", content: absUrl("/profile") },
      { title: "Your account — Hodii" },
      { name: "description", content: "Your Hodii account, password and sign-in." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: absUrl("/profile") }],
  }),
  component: ProfilePage,
});

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function ProfilePage() {
  const { signOut } = useAuth();
  const account = useQuery(accountQuery);
  if (account.isError) return <main className="mx-auto max-w-3xl flex-1 px-4 pt-32 pb-24 text-center"><h1 className="text-4xl">We couldn't load your account</h1><p className="mt-3 text-muted-foreground">Please try again in a moment.</p><Button className="mt-6 rounded-full" onClick={() => account.refetch()}>Try again</Button></main>;
  if (!account.data) return <main className="grid flex-1 place-items-center pt-28 pb-24"><Loader size="lg" label="Loading" /></main>;
  const a = account.data;
  const stats = [
    { icon: Heart, label: "Saved properties", value: a.stats.saved, to: "/saved" as const },
    { icon: Search, label: "Saved searches", value: a.stats.searches, to: "/saved" as const },
    { icon: MessageSquare, label: "Enquiries sent", value: a.stats.enquiries, to: "/dashboard" as const },
  ];
  return (
    <UserShell title="Profile" sub="Your details, activity and sign-in.">
      <section className={`${CARD} flex flex-col gap-5 sm:flex-row sm:items-center`}>
        <AvatarEditor name={a.username} src={a.avatarUrl} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-extrabold">{a.username}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{a.email} · Member since {fmtDate(a.memberSince)}</p>
        </div>
      </section>

      <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {([
          [Heart, "Saved properties", a.stats.saved, "bg-violet-500/15 text-violet-400", "/saved"],
          [Search, "Saved searches", a.stats.searches, "bg-sky-500/15 text-sky-600", "/saved"],
          [MessageSquare, "Enquiries sent", a.stats.enquiries, "bg-violet-500/15 text-violet-600", "/dashboard"],
          [MessageSquare, "Comments", a.comments.comments, "bg-amber-500/15 text-amber-600", null],
          [Reply, "Replies to you", a.comments.replies, "bg-emerald-500/15 text-emerald-600", null],
          [ThumbsUp, "Likes received", a.comments.likesReceived, "bg-indigo-500/15 text-indigo-600", null],
        ] as const).map(([Icon, label, n, tone, to]) => {
          const body = (<><span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon className="size-[18px]" aria-hidden /></span><dd className="mt-3 text-2xl font-extrabold">{n}</dd><dt className="text-xs font-semibold text-muted-foreground">{label}</dt></>);
          return to ? <Link key={label} to={to} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5">{body}</Link> : <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">{body}</div>;
        })}
      </dl>

      <div className="mt-4 grid items-start gap-4">
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <AiAllowanceCard />
          {a.agencies.length > 0 && (
            <section className={CARD}>
              <h2 className="flex items-center gap-2 text-lg font-extrabold"><Building2 className="h-5 w-5" /> Your agencies</h2>
              <ul className="mt-3 grid gap-2">
                {a.agencies.map((g) => (
                  <li key={g.id}><Link to="/dashboard/agency/$slug" params={{ slug: g.slug }} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-accent"><span className="font-semibold">{g.name}</span><span className="text-xs capitalize text-muted-foreground">{g.role}</span></Link></li>
                ))}
              </ul>
            </section>
          )}
          <MyComments />
        </div>
        <Settings username={a.username} email={a.email} onSignOut={signOut} />
      </div>
    </UserShell>
  );
}

function MyComments() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["me", "comments"], queryFn: () => getMyComments() });
  const del = useMutation({
    mutationFn: (commentId: string) => deleteComment({ data: { commentId } }),
    onSuccess: () => { toast.success("Comment deleted"); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <section className={CARD} aria-labelledby="my-comments">
      <h2 id="my-comments" className="text-xl font-extrabold">Your comments</h2>
      {list.isPending && <div className="mt-4"><Loader size="sm" label="Loading" /></div>}
      {list.data && list.data.length === 0 && <div className="empty-card"><p className="text-sm font-semibold text-muted-foreground">You haven't commented on a listing yet. Ask a question on any property page and it will show up here.</p></div>}
      {list.data && list.data.length > 0 && (
        <ul className="mt-4 grid gap-3">
          {list.data.map((c) => (
            <li key={c.id} className="comment-card">
              <p className="text-xs text-muted-foreground">{c.isReply ? "Reply on" : "Comment on"} {c.property ? <Link to="/property/$slug" params={{ slug: c.property.slug }} hash="comments" className="font-semibold underline">{c.property.title}</Link> : "a listing that is no longer online"} · {fmtDate(c.at)}</p>
              <p className="mt-2 whitespace-pre-wrap break-words">{c.text}</p>
              <button type="button" onClick={() => del.mutate(c.id)} className="comment-action mt-2 text-xs font-semibold hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Settings({ username, email, onSignOut }: { username: string; email: string; onSignOut: (everywhere?: boolean) => Promise<void> }) {
  const qc = useQueryClient();
  const [name, setName] = useState(username);
  const [errors, setErrors] = useState<FormErrors>({});
  useEffect(() => setName(username), [username]);
  const save = useMutation({
    mutationFn: () => updateMyUsername({ data: { username: name.trim() } }),
    onSuccess: (r) => {
      if (!r.ok) return setErrors({ username: r.error });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Username saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = fieldError(usernameSchema, name);
    setErrors({ username: err });
    if (!err) save.mutate();
  };
  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="contents">
        <form onSubmit={submit} noValidate className={CARD}>
          <h2 className="text-xl font-extrabold">Username</h2>
          <div className="mt-5 grid gap-4">
            <div>
              <div className="flex justify-between"><label htmlFor="pf-u" className="auth-label">Username</label><span className="text-xs text-muted-foreground">{name.length}/{LIMITS.usernameMax}</span></div>
              <input id="pf-u" className="auth-input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.username} />
              {errors.username && <p role="alert" className="auth-error">{errors.username}</p>}
            </div>
            <Button type="submit" disabled={save.isPending || name.trim() === username} className="h-12 rounded-full font-bold">{save.isPending && <Loader size="xs" />}Save</Button>
          </div>
        </form>
        <ChangePassword email={email} />
        <ChangeEmail email={email} />
        <RecoverySettings />
        <DownloadData />
      </div>
      <section className={CARD}>
        <h2 className="flex items-center gap-2 text-xl font-extrabold"><ShieldCheck className="h-5 w-5" /> Account & sessions</h2>
        <p className="mt-2 text-sm text-muted-foreground">Signed in as <strong className="text-foreground">{email}</strong>. You stay signed in on this device until you sign out, or after {LIMITS.sessionIdleDays} days without a visit.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" className="rounded-full" onClick={() => onSignOut()}><LogOut className="h-4 w-4" /> Sign out</Button>
          <Button variant="outline" className="rounded-full" onClick={() => onSignOut(true)}>Sign out on all devices</Button>
        </div>
        <DeleteAccount onDone={() => onSignOut()} />
      </section>
    </div>
  );
}

function ChangePassword({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = { current: current ? null : "Enter your current password", next: passwordError(next, [(email.split("@")[0] ?? "")]) ?? (next === current ? "New password must be different" : null), confirm: confirm === next ? null : "Passwords don't match" };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    const res = await changePassword({ data: { current, next } }).catch((e: Error) => ({ ok: false as const, error: e.message }));
    setBusy(false);
    if (!res.ok) return setErrors({ form: res.error });
    setCurrent(""); setNext(""); setConfirm("");
    toast.success("Password changed");
  };
  return (
    <form onSubmit={submit} noValidate className={CARD}>
      <h2 className="text-xl font-extrabold">Change password</h2>
      <div className="mt-5 grid gap-4">
        <PasswordField label="Current password" value={current} onChange={setCurrent} error={errors.current} autoComplete="current-password" />
        <PasswordField label="New password" value={next} onChange={setNext} error={errors.next} autoComplete="new-password" showStrength context={[(email.split("@")[0] ?? "")]} maxLength={LIMITS.passwordMax} />
        <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} error={errors.confirm} autoComplete="new-password" />
        {errors.form && <p role="alert" className="auth-banner">{errors.form}</p>}
        <Button type="submit" disabled={busy} className="h-12 rounded-full font-bold">{busy && <Loader size="xs" />}Update password</Button>
      </div>
    </form>
  );
}

function DeleteAccount({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [phrase, setPhrase] = useState("");
  const del = useMutation({ mutationFn: () => deleteMyAccount({ data: { password: pw, confirm: phrase } }), onSuccess: () => { toast.success("Your account was deleted"); onDone(); }, onError: (e) => toast.error((e as Error).message) });
  return (
    <>
      <Button variant="ghost" className="mt-4 rounded-full text-destructive" onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" /> Delete account</Button>
      <AlertDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPw(""); setPhrase(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>Your sign-in, saved properties and saved searches are removed, your notifications and comments are deleted, and your feedback is made anonymous. Enquiries you sent stay with the agencies, no longer linked to you. If you are the only owner of an agency, hand it over first. This can't be undone. Download your data first if you want a copy.</AlertDialogDescription>
          </AlertDialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (phrase.trim() === "DELETE" && pw && !del.isPending) del.mutate(); }}>
            <label className="block text-sm font-semibold" htmlFor="del-pw">Your password</label>
            <input id="del-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" />
            <label className="block text-sm font-semibold" htmlFor="del-ph">Type DELETE to confirm</label>
            <input id="del-ph" autoComplete="off" value={phrase} onChange={(e) => setPhrase(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" />
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Keep account</AlertDialogCancel>
              <button type="submit" data-tone="solid-danger" disabled={del.isPending || !pw || phrase.trim() !== "DELETE"} className="inline-flex h-10 items-center justify-center rounded-full bg-destructive px-5 text-sm font-bold text-destructive-foreground disabled:opacity-50">{del.isPending ? "Deleting…" : "Delete forever"}</button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ChangeEmail({ email }: { email: string }) {
  const qc = useQueryClient();
  const [next, setNext] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setBusy(true);
    const res = await changeEmail({ data: { email: next.trim(), password: pw } }).catch((x: Error) => ({ ok: false as const, error: x.message }));
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setNext(""); setPw(""); qc.invalidateQueries({ queryKey: ["me"] }); qc.invalidateQueries({ queryKey: ["auth", "me"] });
    toast.success("Email changed. Use it the next time you sign in.");
  };
  return (
    <form onSubmit={submit} className={CARD}>
      <h2 className="text-xl font-extrabold">Change email</h2>
      <p className="mt-1 text-sm text-muted-foreground">You sign in with <strong className="text-foreground">{email}</strong>.</p>
      <div className="mt-5 grid gap-4">
        <div><label htmlFor="ce-e" className="auth-label">New email</label><input id="ce-e" type="email" autoComplete="email" required className="auth-input" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        <PasswordField label="Your password" value={pw} onChange={setPw} autoComplete="current-password" />
        {error && <p role="alert" className="auth-error">{error}</p>}
        <Button type="submit" disabled={busy || !next || !pw} className="h-12 rounded-full font-bold">{busy && <Loader size="xs" />}Change email</Button>
      </div>
    </form>
  );
}

function RecoverySettings() {
  const { data, refetch } = useQuery({ queryKey: ["security-status"], queryFn: () => getSecurityStatus() });
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const make = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setBusy(true);
    const res = await regenerateRecoveryCodes({ data: { password: pw } }).catch((x: Error) => ({ ok: false as const, error: x.message }));
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setCodes(res.codes); setPw("");
  };
  return (
    <section className={CARD}>
      <h2 className="text-xl font-extrabold">Recovery codes</h2>
      <p className="mt-1 text-sm text-muted-foreground">Codes are how you get back in if you forget your password. {data ? `You have ${data.codesLeft} of ${data.codesTotal} left.` : ""}{data && data.codesLeft <= 2 ? " Make a new set soon." : ""}</p>
      {codes ? <div className="mt-5"><RecoveryCodes codes={codes} doneLabel="Done" onDone={() => { setCodes(null); setOpen(false); refetch(); }} /></div>
        : open ? (
          <form onSubmit={make} className="mt-5 grid gap-4">
            <p className="text-sm">A new set replaces your old codes, which stop working.</p>
            <PasswordField label="Your password" value={pw} onChange={setPw} autoComplete="current-password" />
            {error && <p role="alert" className="auth-error">{error}</p>}
            <Button type="submit" disabled={busy || !pw} className="h-12 rounded-full font-bold">{busy && <Loader size="xs" />}Make new codes</Button>
          </form>
        ) : <Button variant="outline" className="mt-5 rounded-full" onClick={() => setOpen(true)}>Make new recovery codes</Button>}
    </section>
  );
}

function AvatarEditor({ name, src }: { name: string; src: string | null }) {
  const { refresh } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const done = () => { void refresh(); };
  const pick = async (f: File) => {
    setBusy(true);
    try { await setMyAvatar({ data: { url: (await uploadAvatar(f)).url } }); toast.success("Profile picture updated"); done(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not upload that photo"); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const remove = async () => { setBusy(true); try { await setMyAvatar({ data: { url: null } }); done(); } finally { setBusy(false); } };
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="relative inline-block overflow-hidden rounded-full"><UserAvatar name={name} hue={200} size="lg" src={src} />{busy && <UploadingOverlay rounded="rounded-full" />}</span>
      <input ref={input} type="file" accept="image/*,.heic,.heif,.avif,.jfif" hidden aria-label="Choose a profile picture" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
      <div className="flex gap-3 text-xs font-bold">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="underline">{busy ? "Uploading…" : src ? "Change photo" : "Add photo"}</button>
        {src && !busy && <button type="button" onClick={remove} className="underline opacity-80">Remove</button>}
      </div>
    </div>
  );
}

function DownloadData() {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setBusy(true);
    const res = await exportMyData({ data: { password: pw } }).catch((x: Error) => ({ ok: false as const, error: x.message }));
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    const url = URL.createObjectURL(new Blob([res.json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `hodii-my-data-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url); setPw("");
    toast.success("Your data was downloaded");
  };
  return (
    <form onSubmit={go} className={CARD}>
      <h2 className="text-xl font-extrabold">Download your data</h2>
      <p className="mt-1 text-sm text-muted-foreground">A file with your account details, saved homes and searches, enquiries and replies, reviews and comments.</p>
      <div className="mt-5 grid gap-4">
        <PasswordField label="Your password" value={pw} onChange={setPw} autoComplete="current-password" />
        {error && <p role="alert" className="auth-error">{error}</p>}
        <Button type="submit" disabled={busy || !pw} className="h-12 rounded-full font-bold">{busy && <Loader size="xs" />}Download my data</Button>
      </div>
    </form>
  );
}
