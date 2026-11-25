import { Bath, BedDouble, Building2, CheckCircle2, CircleDollarSign, Clock, Home, KeyRound, Landmark, MapPin, Ruler, ShieldCheck, Sofa, Sparkles, Tag, Tent, Trees, Warehouse, Waves, Zap } from "lucide-react";

/** Shared meaningful icons for filter options, with optional explicit overrides. */
export function OptionIcon({ label, context = "" }: { label: string; context?: string }) {
  const text = `${context} ${label}`.toLowerCase();
  const Icon = /bed/.test(text) ? BedDouble : /bath/.test(text) ? Bath : /price|kes|budget/.test(text) ? CircleDollarSign
    : /location|county|kenya|region|nairobi|area drawn|map pin/.test(text) ? MapPin : /furnish|sofa/.test(text) ? Sofa
    : /condition/.test(text) ? CheckCircle2 : /size|sqm|m²/.test(text) ? Ruler : /verified|security/.test(text) ? ShieldCheck
    : /pool/.test(text) ? Waves : /power|electric|solar/.test(text) ? Zap : /garden|land|farm/.test(text) ? Trees
    : /apartment|flat|commercial|office/.test(text) ? Building2 : /warehouse|industrial/.test(text) ? Warehouse
    : /rent/.test(text) ? KeyRound : /sale/.test(text) ? Tag : /stay|holiday/.test(text) ? Tent
    : /sort|newest|recent/.test(text) ? Clock : /house|home|residential|villa|bungalow/.test(text) ? Home
    : /category|type/.test(text) ? Landmark : Sparkles;
  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
}