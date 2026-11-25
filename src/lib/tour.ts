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
  home: "Find a place in 10 steps", results: "Get the most from search", listing: "What to do on a listing",
  "agency-overview": "Your dashboard at a glance", "agency-listings": "Add and manage listings", "agency-space": "Your free listing space",
  "agency-premium": "Premium packages", "agency-enquiries": "Handle enquiries", "agency-settings": "Agency details and verification",
};

export const TOURS: Record<TourId, TourStep[]> = {
  home: [
    { target: "hero-search", title: "1. Say what you want", text: "Type it the way you would say it, for example \"2 bedroom flat in Kilimani under 80k\". We pick out the place, price and bedrooms and turn them into filters. Misspelt a place? We offer the closest real names underneath." },
    { target: "voice", title: "2. Or just talk", text: "Tap the microphone, allow it once when your browser asks, and speak. Say \"stop\" or pause for a moment and it stops by itself. With the AI chat closed it fills the search box; with the chat open it sends what you said to the AI." },
    { target: "ask-ai", title: "3. Ask AI, then Refine", text: "Ask AI opens a chat inside this same box. The AI shows what it understood, what it added, changed or removed, and whether it found a match. Keep talking to adjust the same search (\"make it Nairobi\", \"balcony is not a must\"), or say \"new search\" to start over. The button reads Refine while the chat is open." },
    { target: "clear-all", title: "4. Start fresh in one tap", text: "Clear all removes your filters, the typed text, any map area or pin, and the chat, without opening the Filters panel. It appears once there is something to clear." },
    { target: "home-map", title: "5. Search on the map", text: "Drop a pin, draw an area or use My location, and the listings below follow the map. Point at the edge of a shape to resize it, or inside it to move it." },
    { target: "layout", title: "6. Pick your layout", text: "Switch between the list, the grid and the map-beside-list views. Your choice is remembered." },
    { target: "latest", title: "7. Browse the newest", text: "Fresh listings from verified and other agents appear here. Open any one to see photos, features, the map and the agent." },
    { target: "counties", title: "8. Browse by county", text: "Prefer to start from a place? Tap a county to see everything listed there." },
    { target: "compare", title: "9. Compare homes", text: "The arrows button opens your comparison. Add up to 4 listings with the Compare button on any listing, then open this." },
    { target: "feedback", title: "10. Something wrong?", text: "Hodii is still being built. Use this button on any page to report a bug or tell us what to improve." },
  ],
  results: [
    { target: "filters", title: "1. Search and filter", text: "Pick Buy, Rent or Short stay, then the dropdowns for type, price and bedrooms. Results change as you choose; there is no Apply button. Typing and voice here only use these filters, and the AI chat keeps its own, so one never leaks into the other." },
    { target: "ask-ai", title: "2. Ask AI", text: "Open the chat in this same box to describe what you want. Follow-ups edit the same search instead of starting again." },
    { target: "clear-all", title: "3. Clear all", text: "One tap removes every filter, the text, the map area and the chat." },
    { target: "layout", title: "4. Change the layout", text: "Switch between list, grid and map views. It stays on the right of this bar." },
    { target: "save-search", title: "5. Get alerted", text: "Tap Save search, choose instant, daily or weekly, and we notify you in the bell when new listings match." },
    { target: "save", title: "6. Save a home", text: "Tap the heart on a listing to keep it. Sign in to see it on any device." },
    { target: "compare", title: "7. Compare", text: "Tap Compare on up to four listings, then open Compare in the top bar to see them side by side." },
  ],
  listing: [
    { target: "save", title: "1. Save it", text: "Tap the heart to keep this listing and be told if the price drops." },
    { target: "share", title: "2. Share", text: "Send this listing to family or friends. On a phone it opens your share sheet; on a computer it copies the link." },
    { target: "compare", title: "3. Compare it", text: "Add this home to your comparison tray to weigh it against up to three others." },
    { target: "contact", title: "4. Contact the agent", text: "Send an enquiry here, or tap Show number to call. Never pay anything before you have seen the place in person." },
  ],
  "agency-overview": [
    { target: "attention", title: "0. Needs your attention", text: "This card sits at the top of every dashboard. Red means urgent, yellow needs doing soon, blue is good to know, green means nothing is waiting. Tap its button to go straight to the fix." },
    { target: "tab-listings", title: "1. Start with listings", text: "Open Listings to add your first property. It goes live straight away." },
    { target: "tab-agency", title: "2. Apply for verification", text: "Open Agency, then the verification section, and add your registration details. You can keep listing while we check; the verified badge appears once approved." },
    { target: "feedback", title: "3. Need help?", text: "The Guide link (top right of this page) has step-by-step help, and this button reaches us directly." },
  ],
  "agency-listings": [
    { target: "add-listing", title: "1. Add a listing", text: "Tap here. The form has six steps and saves a draft as you go. You need at least one photo, a price and a county. Good photos and an honest price bring the most enquiries." },
    { target: "space-meter", title: "2. Your free space", text: "This bar shows how many free (Basic) listings you have used. Past the limit, the oldest are frozen, never deleted. Boosted and Premium listings do not count." },
    { title: "3. Keep listings fresh", text: "Listings last 90 days. Renew before they expire, freeze one to make room, or boost it to be seen first." },
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
