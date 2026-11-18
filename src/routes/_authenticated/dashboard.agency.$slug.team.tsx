import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Sel } from "@/components/ui/sel";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Field, btnGhost, btnPrimary, errorText, inputCls } from "@/components/dashboard/ui";
import { can, canInviteRole } from "@/lib/access";
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
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="members">
        <h2 id="members" className="mb-4 text-xl font-extrabold">Team</h2>
        {isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : isError ? <p role="alert" className="text-sm text-destructive">{errorText(error, "Could not load the team.")}</p> : (
          <ul className="space-y-3">
            {data.map((m) => (
              <li key={m.userId} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
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
        <section aria-labelledby="add" className="glass h-fit rounded-3xl p-5">
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
    </div>
  );
}
