import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sel } from "@/components/ui/sel";
import { useState } from "react";
import { Field, btnPrimary, errorText, inputCls } from "@/components/dashboard/ui";
import { useAuth } from "@/hooks/use-auth";
import { createMyAgency } from "@/lib/agency.functions";
import { COUNTY_LIST , COUNTY_LIST_NAIROBI_FIRST } from "@/lib/mongodb/kenya";
import { MAX_OWNED_AGENCIES } from "@/lib/access";
import { AGENCY_KINDS } from "@/lib/mongodb/taxonomy";

export const Route = createFileRoute("/_authenticated/dashboard/agency/new")({
  head: () => ({ meta: [{ title: "Create an agency — Hodii" }, { name: "robots", content: "noindex" }] }),
  component: NewAgency,
});

function NewAgency() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <main className="mx-auto max-w-xl px-4 pt-28 pb-24">
      <h1 className="text-3xl font-extrabold">Create an agency</h1>
      <p className="mt-2 text-muted-foreground">Listings are published under an agency name. You become its owner and can add agents later. You can own up to {MAX_OWNED_AGENCIES} agencies.</p>
      <form className="border border-border bg-card shadow-sm mt-8 grid gap-5 rounded-3xl p-6" onSubmit={async (e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setErr(null);
        try {
          const r = await createMyAgency({ data: { name: String(f.get("name")), kind: String(f.get("kind")) as never, phone: String(f.get("phone")), countyCode: f.get("county") ? Number(f.get("county")) : null } });
          await refresh();
          navigate({ to: "/dashboard/agency/$slug", params: { slug: r.slug } });
        } catch (e2) { setErr(errorText(e2, "Please check the agency name and phone number.")); } finally { setBusy(false); }
      }}>
        <Field id="n" label="Agency or business name"><input id="n" name="name" required minLength={2} maxLength={80} className={inputCls} placeholder="Acme Homes Ltd" /></Field>
        <Field id="k" label="Type"><Sel id="k" name="kind" className={inputCls}>{AGENCY_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</Sel></Field>
        <Field id="p" label="Business phone" hint="Shown to people who ask to call you."><input id="p" name="phone" type="tel" required className={inputCls} placeholder="0712 345 678" /></Field>
        <Field id="c" label="County"><Sel id="c" name="county" className={inputCls}><option value="">Choose a county</option>{COUNTY_LIST_NAIROBI_FIRST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Sel></Field>
        {err && <p role="alert" className="text-sm font-semibold text-destructive">{err}</p>}
        <button disabled={busy} className={btnPrimary}>{busy ? "Creating…" : "Create agency"}</button>
      </form>
    </main>
  );
}
