import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";

const L = Link as unknown as ComponentType<Record<string, unknown>>;

export type Level = "urgent" | "warn" | "info" | "good";
export type Attention = { id: string; level: Level; title: string; text?: ReactNode; to?: string; params?: Record<string, string>; search?: Record<string, string>; cta?: string };

/* Each level has one colour; the items inside are a see-through tint of that same colour, never white. */
const LOOK: Record<Level, { box: string; row: string; icon: ComponentType<{ className?: string }>; ic: string; btn: string; rank: number }> = {
  urgent: { box: "border-red-300 bg-red-100/80 text-red-950", row: "border-red-400/30 bg-red-500/10 backdrop-blur-md [background-image:linear-gradient(135deg,rgb(255_255_255/.5),rgb(255_255_255/0)_60%)] shadow-[inset_0_1px_0_rgb(255_255_255/.7),0_8px_22px_-14px_rgb(24_24_27/.3)]", icon: AlertOctagon, ic: "bg-red-500 text-white", btn: "bg-red-600 text-white hover:bg-red-700", rank: 0 },
  warn: { box: "border-amber-300 bg-amber-100/80 text-amber-950", row: "border-amber-500/30 bg-amber-500/10 backdrop-blur-md [background-image:linear-gradient(135deg,rgb(255_255_255/.5),rgb(255_255_255/0)_60%)] shadow-[inset_0_1px_0_rgb(255_255_255/.7),0_8px_22px_-14px_rgb(24_24_27/.3)]", icon: AlertTriangle, ic: "bg-amber-400 text-amber-950", btn: "bg-amber-500 text-amber-950 hover:bg-amber-400", rank: 1 },
  info: { box: "border-sky-300 bg-sky-100/80 text-sky-950", row: "border-sky-400/30 bg-sky-500/10 backdrop-blur-md [background-image:linear-gradient(135deg,rgb(255_255_255/.5),rgb(255_255_255/0)_60%)] shadow-[inset_0_1px_0_rgb(255_255_255/.7),0_8px_22px_-14px_rgb(24_24_27/.3)]", icon: Info, ic: "bg-sky-500 text-white", btn: "bg-sky-600 text-white hover:bg-sky-700", rank: 2 },
  good: { box: "border-emerald-300 bg-emerald-100/80 text-emerald-950", row: "border-emerald-400/30 bg-emerald-500/10 backdrop-blur-md [background-image:linear-gradient(135deg,rgb(255_255_255/.5),rgb(255_255_255/0)_60%)] shadow-[inset_0_1px_0_rgb(255_255_255/.7),0_8px_22px_-14px_rgb(24_24_27/.3)]", icon: CheckCircle2, ic: "bg-emerald-500 text-white", btn: "bg-emerald-600 text-white hover:bg-emerald-700", rank: 3 },
};

const Ctx = createContext<Attention[]>([]);
/** A dashboard hands its list down once; each page shows it right under its own title with <AttentionSlot />. */
export function AttentionProvider({ items, children }: { items: Attention[]; children: ReactNode }) {
  return <Ctx.Provider value={items}>{children}</Ctx.Provider>;
}
/** Shows the card under a page title. When nothing is waiting it stays hidden, except on the overview where it says all clear. */
export function AttentionSlot({ overview = false }: { overview?: boolean }) {
  const items = useContext(Ctx);
  return <AttentionCard items={items} overview={overview} />;
}

export function AttentionCard({ items, overview = false }: { items: Attention[]; overview?: boolean }) {
  if (!items.length && !overview) return null;
  const list = (items.length ? [...items].sort((a, b) => LOOK[a.level].rank - LOOK[b.level].rank) : [{ id: "ok", level: "good" as Level, title: "You are all caught up", text: "Nothing needs your attention right now." }]).slice(0, 4);
  const top = list[0]!.level;
  return (
    <section aria-label="Needs your attention" data-tour="attention" className={`mb-6 rounded-3xl border p-4 md:p-5 ${LOOK[top].box}`}>
      <h2 className="mb-3 text-sm font-extrabold opacity-80">{top === "good" ? "All clear" : "Needs your attention"}</h2>
      <ul className="space-y-2.5">
        {list.map((a) => {
          const k = LOOK[a.level]; const I = k.icon;
          return (
            <li key={a.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 backdrop-blur-sm sm:flex-nowrap ${k.row}`}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${k.ic}`}><I className="size-[18px]" /></span>
              <div className="min-w-0 flex-1"><p className="font-bold leading-tight">{a.title}</p>{a.text && <p className="mt-0.5 text-sm opacity-80">{a.text}</p>}</div>
              {a.to && a.cta && <L to={a.to} {...(a.params ? { params: a.params } : {})} {...(a.search ? { search: a.search } : {})} className={`inline-flex h-9 shrink-0 items-center rounded-xl px-4 text-sm font-bold transition ${k.btn}`}>{a.cta}</L>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
