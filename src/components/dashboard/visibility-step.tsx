import { useQuery } from "@tanstack/react-query";
import { Crown, Rocket } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BOOST_PRESETS, quoteBoost } from "@/lib/pricing";
import { getPromoteInfo } from "@/lib/payments.functions";
import { errorText, inputCls } from "@/components/dashboard/ui";

export type Visibility = { plan: "basic" | "boost" | "premium"; days: number | null; packageId: string | null };
export const BASIC: Visibility = { plan: "basic", days: null, packageId: null };

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;

/** The last step before Publish. Nothing here is charged yet: a boost is paid on the next screen, once the listing is live. */
export function VisibilityStep({ slug, listingId, value, onChange, live }: { slug: string; listingId: string | null; value: Visibility; onChange: (v: Visibility) => void; live: boolean }) {
  const { data, isPending, isError, error } = useQuery({ queryKey: ["agency", slug, "promote", listingId], queryFn: () => getPromoteInfo({ data: { slug, id: listingId! } }), enabled: !!listingId });
  if (!listingId) return <p role="note" className="rounded-2xl border border-border p-5 text-sm">Your draft is saved when you press Continue, so the price for your property can be worked out here.</p>;
  if (isPending) return <p className="text-sm text-muted-foreground">Working out prices…</p>;
  if (isError) return <p role="alert" className="text-sm text-destructive">{errorText(error)}</p>;
  const maxDays = data.config.maxDays;
  const days = value.days ?? data.config.defaultDays;
  const q = quoteBoost(data.priceInput, days, data.config);
  const card = (on: boolean) => `block cursor-pointer rounded-2xl border p-5 ${on ? "border-foreground/60 bg-foreground/5 ring-2 ring-foreground/60" : "border-border"}`;
  return (
    <div className="space-y-4">
      {(data.boostUntil || data.premiumUntil) && (
        <p role="note" className="rounded-2xl bg-foreground/10 p-4 text-sm">
          {data.premiumUntil ? <>This listing is <strong>Premium</strong> until {new Date(data.premiumUntil).toLocaleDateString("en-KE", { dateStyle: "long" })}.</> : <>This listing is <strong>boosted</strong> until {new Date(data.boostUntil!).toLocaleDateString("en-KE", { dateStyle: "long" })}.</>}
        </p>
      )}
      <fieldset className="space-y-3">
        <legend className="sr-only">How visible should this listing be?</legend>

        <label className={card(value.plan === "basic")}>
          <input type="radio" name="plan" className="sr-only" checked={value.plan === "basic"} onChange={() => onChange(BASIC)} />
          <span className="block text-lg font-extrabold">Basic · free</span>
          <span className="block text-sm text-muted-foreground">Your listing is published and appears in search like every other listing, ranked by how well it matches. You can boost it later.</span>
        </label>

        <label className={card(value.plan === "boost")}>
          <input type="radio" name="plan" className="sr-only" checked={value.plan === "boost"} onChange={() => onChange({ plan: "boost", days, packageId: null })} />
          <span className="flex items-center gap-2 text-lg font-extrabold"><Rocket className="h-5 w-5 text-primary" aria-hidden />Boost this listing</span>
          <span className="block text-sm text-muted-foreground">A Boosted badge, a lift in search and a place in the boosted strips. You choose the days and pay by M-Pesa on the next screen.</span>
          {value.plan === "boost" && (
            <span className="mt-4 block space-y-3">
              <span className="flex flex-wrap gap-2">
                {BOOST_PRESETS.filter((d) => d <= maxDays).map((d) => <button key={d} type="button" aria-pressed={days === d} onClick={() => onChange({ plan: "boost", days: d, packageId: null })} className={`rounded-full border px-4 py-1.5 text-sm font-bold ${days === d ? "border-foreground bg-foreground text-background" : "border-border"}`}>{d} days</button>)}
              </span>
              <span className="block"><span className="mb-1 block text-sm font-semibold">Or any number of days (up to {maxDays})</span>
                <input aria-label="Number of days" type="number" inputMode="numeric" min={1} max={maxDays} value={days} onChange={(e) => onChange({ plan: "boost", days: Math.max(0, Math.round(Number(e.target.value))), packageId: null })} className={`${inputCls} w-28`} /></span>
              <span className="block" aria-live="polite">{q ? <><span className="text-2xl font-extrabold">{kes(q.amountKes)}</span> <span className="text-sm text-muted-foreground">{kes(q.perDayKes)} a day{q.discountPct > 0 ? ` · you save ${q.discountPct}%` : ""}</span></> : <span className="text-sm text-destructive">Choose between 1 and {maxDays} days.</span>}</span>
              {!data.paymentsEnabled && <span className="block text-xs text-muted-foreground">Online payment is not switched on yet. Contact support@hodii.co.ke to boost this listing.</span>}
            </span>
          )}
        </label>

        {data.canBuyPackage && (
          <label className={card(value.plan === "premium")}>
            <input type="radio" name="plan" className="sr-only" checked={value.plan === "premium"} onChange={() => onChange({ plan: "premium", days: null, packageId: data.packagesWithRoom[0]?.id ?? null })} />
            <span className="flex items-center gap-2 text-lg font-extrabold"><Crown className="h-5 w-5 text-amber-500" aria-hidden />Premium package</span>
            <span className="block text-sm text-muted-foreground">Premium placement and badge, as part of a package for many listings. Add this listing to a package you already have.</span>
            {value.plan === "premium" && (
              <span className="mt-4 block space-y-2">
                {data.packagesWithRoom.length ? data.packagesWithRoom.map((k) => (
                  <span key={k.id} className="flex items-center gap-2 text-sm"><input type="radio" name="pkg" checked={value.packageId === k.id} onChange={() => onChange({ plan: "premium", days: null, packageId: k.id })} /> Package ending {new Date(k.endsAt).toLocaleDateString("en-KE", { dateStyle: "medium" })} · {k.free} slot{k.free === 1 ? "" : "s"} free</span>
                )) : <span className="block text-sm">You have no package with room.</span>}
                <Link to="/dashboard/agency/$slug/premium" params={{ slug }} target="_blank" className="inline-block text-sm font-bold text-primary underline">Buy or manage packages (opens in a new tab)</Link>
              </span>
            )}
          </label>
        )}
      </fieldset>
      <p className="text-xs text-muted-foreground">{live ? "Changes here apply when you save." : "Publishing is free. Nothing is charged until you confirm a payment on your phone."} Paid listings always carry a badge and are shown among results, never instead of better matches.</p>
    </div>
  );
}
