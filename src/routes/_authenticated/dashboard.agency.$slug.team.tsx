import { LoaderBlock } from "@/components/loader";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Sel } from "@/components/ui/sel";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Field, btnGhost, btnPrimary, errorText, inputCls, PageHeader } from "@/components/dashboard/ui";
import { ACTION_GROUPS, can, canInviteRole } from "@/lib/access";
import { addAgencyMember, getAgencyTeam, removeAgencyMember, setMemberRole } from "@/lib/dashboard.functions";

const parent = getRouteApi("/_authenticated/dashboard/agency/$slug");
const teamQuery = (slug: string) => queryOptions({ queryKey: ["agency", slug, "team"], queryFn: () => getAgencyTeam({ data: { slug } }) });
export const Route = createFileRoute("/_authenticated/dashboard/agency/$slug/team")({ component: Team });

function Team() {
  const { slug } = Route.useParams();
  const role = parent.useLoaderData().agency.role;
  const qc = useQueryClient();
  const { data, isPending, isError, error } = useQuery(teamQuery(slug));
  const done = () => qc.invalidateQueries({ queryKey: ["agency", slug, "team"] });
  const add = useMutation({ mutationFn: (v: { email: string; role: "admin" | "agent"; title: string | null; phone: string | null }) => addAgencyMember({ data: { slug, ...v } }), onSuccess: (r) => { toast.success(r.delivered ? "Invitation sent. They will see it in their notifications." : "Invitation saved. It will reach them when they sign up with that email."); done(); setErr(null); }, onError: (e) => setErr(errorText(e)) });
  const remove = useMutation({ mutationFn: (userId: string) => removeAgencyMember({ data: { slug, userId } }), onSuccess: () => { toast.success("Removed"); done(); }, onError: (e) => toast.error(errorText(e)) });
  const changeRole = useMutation({ mutationFn: (v: { userId: string; role: "owner" | "admin" | "agent" }) => setMemberRole({ data: { slug, ...v } }), onSuccess: () => { toast.success("Role updated"); done(); }, onError: (e) => toast.error(errorText(e)) });
  const [err, setErr] = useState<string | null>(null);

  return (
    <div>
    <PageHeader title="Team" sub="Who can work in this agency, and what each person can do." />
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="members">
        <h2 id="members" className="mb-4 text-lg font-extrabold">Members</h2>
        {isPending ? <LoaderBlock className="py-10" /> : isError ? <p role="alert" className="text-sm text-destructive">{errorText(error, "Could not load the team.")}</p> : (
          <ul className="space-y-3">
            {data.map((m) => (
              <li key={m.userId} className="border border-border bg-card shadow-sm flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                <div className="min-w-0"><p className="font-bold">{m.username}{m.isMe && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}{m.pending && <span className="admin-badge ml-2" data-tone="warn">Invitation pending</span>}</p><p className="truncate text-xs text-muted-foreground">{[m.title, m.email].filter(Boolean).join(" · ")}</p></div>
                <div className="flex items-center gap-2">
                  {can(role, "team.change_role") && !m.isMe && !m.pending ? (
                    <Sel aria-label={`Role for ${m.username}`} value={m.role} onChange={(e) => changeRole.mutate({ userId: m.userId, role: e.target.value as "owner" | "admin" | "agent" })} className={`${inputCls} h-9 w-28`}><option value="owner">Owner</option><option value="admin">Admin</option><option value="agent">Agent</option></Sel>
                  ) : <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold capitalize">{m.role}</span>}
                  {m.canRemove && <button className={`${btnGhost} h-9 px-3 text-destructive`} onClick={() => confirm(m.pending ? "Cancel this invitation?" : `Remove ${m.username} from the team?`) && remove.mutate(m.userId)}>{m.pending ? "Cancel" : "Remove"}</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {can(role, "team.invite") && (
        <section aria-labelledby="add" className="border border-border bg-card shadow-sm h-fit rounded-3xl p-5">
          <h2 id="add" className="text-lg font-extrabold">Add a team member</h2>
          <p className="mt-1 text-sm text-muted-foreground">They need a Hodii account first. Ask them to sign up, then add them by email.</p>
          <form className="mt-4 grid gap-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); add.mutate({ email: String(f.get("email")), role: String(f.get("role")) as "admin" | "agent", title: String(f.get("title") ?? "").trim() || null, phone: String(f.get("phone") ?? "").trim() || null }); }}>
            <Field id="tm-email" label="Email"><input id="tm-email" name="email" type="email" required className={inputCls} /></Field>
            <Field id="tm-role" label="Role"><Sel id="tm-role" name="role" className={inputCls}><option value="agent">Agent: own listings and enquiries</option>{canInviteRole(role, "admin") && <option value="admin">Admin: all listings and the team</option>}</Sel></Field>
            <Field id="tm-title" label="Job title (optional)"><input id="tm-title" name="title" maxLength={60} className={inputCls} placeholder="Sales agent" /></Field>
            <Field id="tm-phone" label="Phone (optional)"><input id="tm-phone" name="phone" type="tel" className={inputCls} placeholder="0712 345 678" /></Field>
            {err && <p role="alert" className="text-sm font-semibold text-destructive">{err}</p>}
            <button disabled={add.isPending} className={btnPrimary}>{add.isPending ? "Adding…" : "Add to team"}</button>
          </form>
        </section>
      )}
      <section aria-labelledby="roles" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 id="roles" className="text-lg font-extrabold">What each role can do</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-2 pr-3 font-bold">&nbsp;</th>{(["agent", "admin", "owner"] as const).map((r) => <th key={r} className="px-3 py-2 text-center font-bold capitalize">{r}</th>)}</tr></thead>
            <tbody>
              {ACTION_GROUPS.map((g) => (
                <Fragment key={g.group}>
                  <tr><th colSpan={4} className="pt-4 pb-1 text-left text-xs font-bold uppercase tracking-wide text-primary">{g.group}</th></tr>
                  {g.items.map((it) => (
                    <tr key={it.action} className="border-t border-border">
                      <td className="py-2 pr-3">{it.label}</td>
                      {(["agent", "admin", "owner"] as const).map((r) => <td key={r} className="px-3 py-2 text-center">{can(r, it.action) ? <span aria-label="Yes" className="font-bold text-primary">✓</span> : <span aria-label="No" className="text-muted-foreground/50">–</span>}</td>)}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    </div>
  );
}
