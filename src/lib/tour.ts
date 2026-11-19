/** Onboarding tour state. Pure functions plus a tiny localStorage wrapper. State is per browser and per signed-in person. */
/** One short tour per kind of page, so the help is about what the person is looking at right now. */
export type TourId = "home" | "results" | "listing" | "agency-overview" | "agency-listings" | "agency-space" | "agency-premium" | "agency-enquiries" | "agency-settings";
export type TourState = { status: "new" | "running" | "paused" | "snoozed" | "dismissed" | "done"; step: number; until: number; snoozes: number; /** When this state was last changed on this device (ms); the newer of local and server wins. */ at?: number };
export type TourStep = { target?: string; title: string; text: string };

export const SNOOZE_DAYS = [1, 1, 3, 7] as const;
const DAY = 86_400_000;
export const fresh = (): TourState => ({ status: "new", step: 0, until: 0, snoozes: 0 });

/** Ask the person about the tour now? Only when it is new, or a snooze has run out. */
export function shouldPrompt(s: TourState, now: number): boolean {
  return s.status === "new" || (s.status === "snoozed" && now >= s.until);
}
export const start = (s: TourState): TourState => ({ ...s, status: "running", step: s.status === "paused" ? s.step : 0 });
export const resume = (s: TourState): TourState => ({ ...s, status: "running" });
export const pause = (s: TourState): TourState => ({ ...s, status: "paused" });
export const finish = (s: TourState): TourState => ({ ...s, status: "done", step: 0 });
export const dismiss = (s: TourState): TourState => ({ ...s, status: "dismissed" });
/** "Remind me later": 1 day, then 1, 3 and 7. After that the person is left alone. */
export function snooze(s: TourState, now: number): TourState {
  const days = SNOOZE_DAYS[s.snoozes];
  if (days === undefined) return dismiss(s);
  return { ...s, status: "snoozed", until: now + days * DAY, snoozes: s.snoozes + 1 };
}
export const next = (s: TourState, total: number): TourState => (s.step + 1 >= total ? finish(s) : { ...s, step: s.step + 1 });
export const back = (s: TourState): TourState => ({ ...s, step: Math.max(0, s.step - 1) });

const key = (id: TourId, who: string) => `hodii.tour.v1.${id}.${who}`;
export function load(id: TourId, who: string): TourState {
  try {
    const raw = localStorage.getItem(key(id, who));
    if (!raw) return fresh();
    const p = JSON.parse(raw) as Partial<TourState>;
    return { ...fresh(), ...p };
  } catch { return fresh(); }
}
export function save(id: TourId, who: string, s: TourState) { try { localStorage.setItem(key(id, who), JSON.stringify(s)); } catch { /* private mode */ } }

export const TOUR_EVENT = "hodii:tour";
/** From the Help page or the "?" button: start this page's tour again whatever was chosen before. */
export function restartTour(id: TourId | "here") { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: id })); }

/** Which tour belongs to this address. Nothing on admin, sign-in, forms or payment pages. */
export function tourForPath(path: string, signedIn: boolean): TourId | null {
  if (path === "/") return "home";
  if (path === "/properties") return "results";
  if (/^\/property\/[^/]+$/.test(path)) return "listing";
  const m = /^\/dashboard\/agency\/[^/]+(\/[a-z]+)?$/.exec(path);
  if (m && signedIn) {
    switch (m[1]) {
      case undefined: return "agency-overview";
      case "/listings": return "agency-listings";
      case "/space": return "agency-space";
      case "/premium": return "agency-premium";
      case "/enquiries": return "agency-enquiries";
      case "/settings": return "agency-settings";
      default: return null;
    }
  }
  return null;
}

export const TOUR_TITLES: Record<TourId, string> = {
  home: "Find a place in 4 steps", results: "Get the most from search", listing: "What to do on a listing",
  "agency-overview": "Your dashboard at a glance", "agency-listings": "Add and manage listings", "agency-space": "Your free listing space",
  "agency-premium": "Premium packages", "agency-enquiries": "Handle enquiries", "agency-settings": "Agency details and verification",
};

export const TOURS: Record<TourId, TourStep[]> = {
  home: [
    { target: "hero-search", title: "1. Type what you want", text: "Write it the way you would say it, for example \"2 bedroom flat Kilimani under 80k\". We read the price, bedrooms and place for you." },
    { target: "search", title: "2. Search from any page", text: "This magnifier takes you to the full search with all the filters." },
    { target: "compare", title: "3. Compare homes", text: "The arrows button opens your comparison. Add up to 4 listings with the Compare button on any listing, then open this." },
    { target: "feedback", title: "4. Something wrong?", text: "Hodii is still being built. Use this button on any page to report a bug or tell us what to improve." },
  ],
  results: [
    { target: "filters", title: "Filter and search", text: "Pick Buy, Rent or Short stay, then the dropdowns for type, price and bedrooms. Results change as you choose; there is no Apply button." },
    { target: "save-search", title: "Get alerted", text: "Tap Save search, choose instant, daily or weekly, and we notify you in the bell when new listings match." },
    { target: "save", title: "Save a home", text: "Tap the heart on a listing to keep it. Sign in to see it on any device." },
    { target: "compare", title: "Compare", text: "Tap Compare on up to four listings, then open Compare in the top bar to see them side by side." },
  ],
  listing: [
    { target: "save", title: "Save it", text: "Tap the heart to keep this listing and be told if the price drops." },
    { target: "share", title: "Share", text: "Send this listing to family or friends. On a phone it opens your share sheet; on a computer it copies the link." },
    { target: "contact", title: "Contact the agent", text: "Send an enquiry here, or tap Show number to call. Never pay anything before you have seen the place in person." },
  ],
  "agency-overview": [
    { target: "tab-listings", title: "Start with listings", text: "Open Listings to add your first property. It goes live straight away." },
    { target: "tab-agency", title: "Apply for verification", text: "Open Agency, then the verification section, and add your registration details. You can keep listing while we check; the verified badge appears once approved." },
    { target: "feedback", title: "Need help?", text: "The Guide link (top right of this page) has step-by-step help, and this button reaches us directly." },
  ],
  "agency-listings": [
    { target: "add-listing", title: "Add a listing", text: "Tap here. The form has six steps and saves a draft as you go. You need at least one photo, a price and a county." },
    { target: "space-meter", title: "Your free space", text: "This bar shows how many free (Basic) listings you have used. Past the limit, the oldest are frozen, never deleted. Boosted and Premium listings do not count." },
  ],
  "agency-space": [
    { target: "space-meter", title: "Free space meter", text: "Live and stored Basic listings against your limits." },
    { title: "Need more room?", text: "Buy an extra-space pack below, or boost or add a listing to Premium. Frozen listings come back as soon as there is room." },
  ],
  "agency-premium": [
    { title: "Premium packages", text: "A package lifts many listings at once for a set number of days and keeps them out of your free-space count. Pick the number of listings, pay with M-Pesa, then assign listings to it." },
  ],
  "agency-enquiries": [
    { title: "Enquiries", text: "People who message you from a listing appear here. Open one to reply. Leads can be assigned to a teammate. Reply the same day: fast replies win deals." },
  ],
  "agency-settings": [
    { title: "Agency profile", text: "Add your logo, a short story, services and hours. A complete profile gets more enquiries." },
    { title: "Verification", text: "Fill in the verification section and submit it. While it is reviewed you can keep listing; the badge shows once approved." },
  ],
};
