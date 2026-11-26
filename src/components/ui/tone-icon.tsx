import type { LucideIcon } from "lucide-react";

/** The feedback popup's icon colours, reused by every menu, popup and guide card. */
export type Tone = "like" | "idea" | "confusing" | "bug" | "down" | "other";
const ORDER: Tone[] = ["other", "idea", "confusing", "down"];
/** A tone class picked by position, so a list of rows gets varied colours. */
export const toneAt = (i: number) => `tone-${ORDER[i % ORDER.length]}`;

export function ToneIcon({ icon: Icon, tone, size = "md" }: { icon: LucideIcon; tone: Tone; size?: "sm" | "md" }) {
  return <span aria-hidden className={`tone-icon tone-${tone} ${size === "sm" ? "tone-sm size-5" : "size-8"}`}><Icon /></span>;
}

/** Button looks from the feedback popup. */
export const POP_BTN = "tour-cta rounded-xl bg-primary px-3.5 font-bold text-primary-foreground hover:brightness-110";
export const POP_BTN_OUTLINE = "rounded-xl border border-input bg-background/70 px-3.5 font-semibold hover:bg-muted hover:text-foreground";
export const POP_BTN_GHOST = "rounded-xl px-3.5 font-semibold text-muted-foreground hover:bg-muted hover:text-foreground";

/** Title and one-line hint inside a menu card, like the feedback options. */
export const MenuText = ({ label, hint }: { label: string; hint: string }) => (
  <span className="min-w-0"><span className="block font-bold leading-snug">{label}</span><span className="block text-xs leading-snug text-muted-foreground">{hint}</span></span>
);

