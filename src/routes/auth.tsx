import { Building2, Search } from "lucide-react";
import { absUrl } from "@/lib/site";
import { WaveHand } from "@/components/wave-hand";
import { Sel } from "@/components/ui/sel";
import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader, LoaderBlock } from "@/components/loader";

import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/password-field";
import { useAuth } from "@/hooks/use-auth";
import { checkUsername } from "@/lib/account.functions";
import { instantSignUp, recoverAccount, signIn } from "@/lib/signup.functions";
import { RecoveryCodes } from "@/components/recovery-codes";
import { AGENCY_KINDS } from "@/lib/mongodb/taxonomy";
import { COUNTY_LIST, normalizeKenyaPhone , COUNTY_LIST_NAIROBI_FIRST } from "@/lib/mongodb/kenya";
import { LIMITS, emailSchema, passwordError, usernameSchema, type FormErrors, fieldError } from "@/lib/community-rules";

const search = z.object({ redirect: z.string().optional(), mode: z.enum(["signin", "signup", "recover"]).optional(), as: z.enum(["user", "agency"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { property: "og:url", content: absUrl("/auth") },
      { title: "Sign in or join — Hodii" },
      { name: "description", content: "Sign in to Hodii to save properties, track your searches and contact listers." },
      { property: "og:title", content: "Sign in or join — Hodii" },
      { property: "og:description", content: "Save properties, track your searches and contact listers on Hodii." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: absUrl("/auth") }],
  }),
  component: AuthPage,
});

const safePath = (p: string | undefined, fallback: string) => (p && p.startsWith("/") && !p.startsWith("//") ? p : fallback);

function friendly(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "That email and password don't match. Check both and try again.";
    if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Try signing in instead.";
  if (m.includes("pwned") || m.includes("leaked") || m.includes("compromised")) return "This password has appeared in a data breach. Please choose a different one.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a few minutes and try again.";
  return message;
}

function AuthPage() {
  const { redirect, mode: initial, as: initialType } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading, refresh } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "recover">(initial ?? "signin");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [username, setUsername] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accountType, setAccountType] = useState<"user" | "agency">(initialType ?? "user");
  const [agencyName, setAgencyName] = useState("");
  const [agencyKind, setAgencyKind] = useState<(typeof AGENCY_KINDS)[number]["key"]>("estate_agency");
  const [agencyPhone, setAgencyPhone] = useState("");
  const [agencyCounty, setAgencyCounty] = useState("");
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "free" | "taken">("idle");

  useEffect(() => {
    if (!loading && user) navigate({ to: safePath(redirect, user.accountType === "agency" ? user.dashboard : "/profile"), replace: true });
  }, [user, loading, redirect, navigate]);

  useEffect(() => {
    if (mode !== "signup" || !usernameSchema.safeParse(username).success) { setNameStatus("idle"); return; }
    setNameStatus("checking");
    const t = setTimeout(() => {
      checkUsername({ data: { username } }).then((r) => setNameStatus(r.available ? "free" : "taken")).catch(() => setNameStatus("idle"));
    }, 450);
    return () => clearTimeout(t);
  }, [username, mode]);

  const switchMode = (m: typeof mode) => { setMode(m); setErrors({}); setFormError(null); };

  const validate = () => {
    const e: FormErrors = {};
    const em = emailSchema.safeParse(email);
    e.email = em.success ? null : em.error.issues[0]?.message ?? "Invalid value";
    if (mode === "signin") e.password = password ? null : "Enter your password";
    if (mode === "recover") { e.password = passwordError(password, [(email.split("@")[0] ?? "")]); e.confirm = confirm === password ? null : "Passwords don't match"; e.code = recoveryCode.trim().length >= 8 ? null : "Enter one of your recovery codes"; }
    if (mode === "signup") {
      const un = usernameSchema.safeParse(username);
      e.username = !un.success ? un.error.issues[0]?.message ?? "Invalid value" : nameStatus === "taken" ? "That username is already taken" : null;
      e.password = passwordError(password, [(email.split("@")[0] ?? ""), username]);
      e.confirm = confirm === password ? null : "Passwords don't match";
      e.terms = acceptTerms ? null : "Accept the terms and privacy policy to continue";
      if (accountType === "agency") {
        e.agencyName = agencyName.trim().length >= 2 ? null : "Enter your agency or business name";
        e.agencyPhone = normalizeKenyaPhone(agencyPhone) ? null : "Enter a Kenyan phone number, like 0712 345 678";
      }
    }
    setErrors(e);
    return Object.values(e).every((v) => !v);
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        const res = await signIn({ data: { email: email.trim(), password } });
        if (!res.ok) throw new Error(res.error);
        await refresh();
      } else if (mode === "recover") {
        const res = await recoverAccount({ data: { email: email.trim(), code: recoveryCode, password } });
        if (!res.ok) throw new Error(res.error);
        await refresh();
      } else if (mode === "signup") {
        const res = await instantSignUp({ data: { email: email.trim(), password, username: username.trim(), accountType, acceptTerms: true as const, ...(accountType === "agency" ? { agency: { name: agencyName.trim(), kind: agencyKind, phone: agencyPhone.trim(), countyCode: agencyCounty ? Number(agencyCounty) : null } } : {}) } });
        if (res.status === "created") {
          // The session already exists; hold the redirect until the person has seen their recovery codes.
          setCodes(res.recoveryCodes);
        } else {
          throw new Error(`Only ${res.limit} new accounts can be created from one network per day. Please try again tomorrow.`);
        }
      }
    } catch (e) {
      setFormError(friendly((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-40 pb-24">
      <p className="auth-page-title">{mode === "signup" ? "Sign up" : mode === "recover" ? "Recover account" : "Sign in"}</p>
      <div className="glass-strong rounded-[2rem] p-6 shadow-float md:p-8">
        {codes ? <RecoveryCodes codes={codes} onDone={() => { void refresh(); }} /> : <>
        {mode !== "recover" && <div role="tablist" className="flex gap-1 rounded-full bg-secondary p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
              className={`flex-1 rounded-full py-2.5 text-sm font-bold transition ${mode === m ? "bg-primary text-primary-foreground shadow-float" : "text-muted-foreground"}`}>
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>}
        <h1 className="mt-6 text-center text-3xl font-normal">{mode === "signin" ? <>Welcome back <WaveHand /></> : mode === "recover" ? "Reset your password" : <>Join Hodii <WaveHand /></>}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">{mode === "signin" ? "Pick up where you left off." : mode === "recover" ? "Use one of the recovery codes you saved when you signed up." : "Save properties, send enquiries and list your own."}</p>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-4">
          {mode === "signup" && (
            <fieldset>
              <legend className="auth-label">I am</legend>
              <div className="grid gap-2.5">
                {([["user", "Looking for property", "Save listings and send enquiries"], ["agency", "Listing property", "Agent, developer, manager or landlord"]] as const).map(([k, t, d]) => (
                  <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-2xl bg-card p-3.5 text-left transition ${accountType === k ? "shadow-[0_0_0_2px_var(--primary),0_10px_24px_-14px_rgb(24_24_27/.3)]" : "shadow-[var(--btn-shadow)] hover:shadow-[var(--btn-shadow-hover)]"}`}><span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full ${accountType === k ? "bg-primary text-primary-foreground" : "bg-foreground/[0.06]"}`}>{k === "user" ? <Search className="size-4" /> : <Building2 className="size-4" />}</span>
                    <input type="radio" name="accountType" value={k} checked={accountType === k} onChange={() => setAccountType(k)} className="sr-only" />
                    <span className="min-w-0"><span className="block text-sm font-bold">{t}</span><span className="block text-xs text-muted-foreground">{d}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div>
            <label htmlFor="email" className="auth-label">Email</label>
            <input id="email" type="email" autoComplete="email" value={email} maxLength={LIMITS.emailMax + 20}
              onChange={(e) => setEmail(e.target.value)} onBlur={() => email && setErrors((x) => ({ ...x, email: emailSchema.safeParse(email).success ? null : fieldError(emailSchema, email) }))}
              aria-invalid={!!errors.email} className="auth-input" placeholder="name@example.com" />
            {errors.email && <p role="alert" className="auth-error">{errors.email}</p>}
          </div>
          {mode === "signup" && (
            <div>
              <label htmlFor="username" className="auth-label">Username</label>
              <input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)}
                aria-invalid={!!errors.username} className="auth-input" placeholder="jane_wanjiru" />
              <div className="mt-1 flex justify-between text-xs">
                <span className={nameStatus === "taken" ? "text-destructive" : nameStatus === "free" ? "text-success" : "text-muted-foreground"}>
                  {nameStatus === "checking" ? <Loader size="xs" /> : nameStatus === "taken" ? "Already taken" : nameStatus === "free" ? "Available" : "Letters, numbers and underscores"}
                </span>
                <span className={username.length > LIMITS.usernameMax ? "text-destructive" : "text-muted-foreground"}>{username.length}/{LIMITS.usernameMax}</span>
              </div>
              {errors.username && <p role="alert" className="auth-error">{errors.username}</p>}
            </div>
          )}
          {mode === "recover" && <div><label htmlFor="rcode" className="auth-label">Recovery code</label><input id="rcode" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} placeholder="ABCD-EFGH-JKMN" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-invalid={!!errors.code} className="auth-input font-mono" />{errors.code && <p role="alert" className="auth-error">{errors.code}</p>}</div>}
          <PasswordField label={mode === "recover" ? "New password" : "Password"} value={password} onChange={setPassword} error={errors.password}
            autoComplete={mode === "signup" ? "new-password" : "current-password"} showStrength={mode === "signup"}
            context={[(email.split("@")[0] ?? ""), username]} maxLength={LIMITS.passwordMax} />
          {mode === "signin" && <button type="button" onClick={() => switchMode("recover")} className="-mt-2 justify-self-end text-xs font-bold underline">Forgot your password?</button>}
          {(mode === "signup" || mode === "recover") && (
            <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} error={errors.confirm} autoComplete="new-password" />
          )}
          {mode === "signup" && accountType === "agency" && (
            <div className="grid gap-4 rounded-2xl border border-border p-4">
              <p className="text-sm font-bold">Your agency</p>
              <div><label htmlFor="agency-name" className="auth-label">Agency or business name</label><input id="agency-name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} maxLength={80} aria-invalid={!!errors.agencyName} className="auth-input" placeholder="Acme Homes Ltd" />{errors.agencyName && <p role="alert" className="auth-error">{errors.agencyName}</p>}</div>
              <div><label htmlFor="agency-kind" className="auth-label">Type</label><Sel id="agency-kind" value={agencyKind} onChange={(e) => setAgencyKind(e.target.value as typeof agencyKind)} className="auth-input">{AGENCY_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</Sel></div>
              <div><label htmlFor="agency-phone" className="auth-label">Business phone</label><input id="agency-phone" type="tel" value={agencyPhone} onChange={(e) => setAgencyPhone(e.target.value)} autoComplete="tel" aria-invalid={!!errors.agencyPhone} className="auth-input" placeholder="0712 345 678" />{errors.agencyPhone && <p role="alert" className="auth-error">{errors.agencyPhone}</p>}</div>
              <div><label htmlFor="agency-county" className="auth-label">County</label><Sel id="agency-county" value={agencyCounty} onChange={(e) => setAgencyCounty(e.target.value)} className="auth-input"><option value="">Choose a county</option>{COUNTY_LIST_NAIROBI_FIRST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Sel></div>
            </div>
          )}
          {mode === "signup" && (
            <div>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} aria-invalid={!!errors.terms} className="mt-1 size-4 shrink-0" /><span>I agree to the <Link to="/info/$slug" params={{ slug: "terms" }} target="_blank" className="font-bold underline">terms</Link> and the <Link to="/info/$slug" params={{ slug: "privacy" }} target="_blank" className="font-bold underline">privacy policy</Link>.</span></label>
              {errors.terms && <p role="alert" className="auth-error">{errors.terms}</p>}
            </div>
          )}
          {formError && <p role="alert" className="auth-banner">{formError}</p>}
          <Button type="submit" disabled={busy} className="h-12 rounded-full text-base font-bold">
            {busy && <Loader size="xs" />}
            {mode === "signin" ? "Sign in" : mode === "recover" ? "Reset password" : "Create account"}
          </Button>
          {mode === "recover" && <button type="button" onClick={() => switchMode("signin")} className="text-center text-sm font-bold underline">Back to sign in</button>}
        </form>
        </>}
      </div>
    </main>
  );
}
