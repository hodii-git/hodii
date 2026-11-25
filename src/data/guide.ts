import type { Article } from "@/lib/guide-search";

export const USER_CATEGORIES = ["Getting started", "Searching", "Saving and comparing", "Contacting agents", "Your account", "Safety"] as const;
export const AGENCY_CATEGORIES = ["Getting started", "Listings", "Limits and paying", "Verification", "Team and account"] as const;

export const ARTICLES: readonly Article[] = [
  // ---------- Normal users ----------
  { id: "find-a-home", audience: "user", category: "Getting started", title: "Find a place to rent or buy", summary: "Search, filter and open a listing.", keywords: ["search", "start", "rent", "buy", "browse", "bedsitter", "flat"],
    body: [{ p: "Use the search box on the home page or Properties. Type naturally, for example \"2 bedroom flat in Kilimani under 80k to rent\". Hodii turns the parts it understands into filters." },
      { steps: ["Pick Rent, Buy or Short stay.", "Choose a county or area, and a property type.", "Set your budget and bedrooms.", "Open a listing to see photos, features, map and the agent."] },
      { note: "Results are ordered by best match. You can change the order at any time." }], related: ["filters", "ai-search"] },
  { id: "filters", audience: "user", category: "Searching", title: "Use filters", summary: "Narrow results by price, type, location and features.", keywords: ["filter", "price", "county", "bedrooms", "features", "furnished", "verified"],
    body: [{ p: "Every filter is a dropdown. Results update as you choose, no Apply button needed." }, { bullets: ["Nairobi is pinned first in county lists.", "Turn on Verified only to see agencies we have approved.", "Pick several property types at once."] }] },
  { id: "ai-search", audience: "user", category: "Searching", title: "Ask AI to search for you", summary: "Describe what you want in your own words.", keywords: ["ai", "natural language", "describe", "limit", "allowance", "quota"],
    body: [{ p: "Tap the AI button, describe what you want and we fill in the filters. You get a limited number of AI searches in each window, shown next to the button, and a countdown tells you when it refills. Signing in gives you more. Normal search is never limited." }] },
  { id: "no-results", audience: "user", category: "Searching", title: "I get no results", summary: "What to try when nothing matches.", keywords: ["no results", "empty", "nothing", "zero", "typo", "spelling"],
    body: [{ bullets: ["Check spelling. We try close matches automatically and tell you when we do.", "Remove a filter, usually the price or bedrooms.", "Try the county instead of the estate name.", "Save the search and we will notify you when something matching appears."] }] },
  { id: "save-property", audience: "user", category: "Saving and comparing", title: "Save a property", summary: "Keep favourites with the heart.", keywords: ["save", "favourite", "heart", "shortlist", "wishlist"],
    body: [{ p: "Tap the heart on any listing. Sign in so your saved list follows you to any device. Find them under your profile." }] },
  { id: "saved-search", audience: "user", category: "Saving and comparing", title: "Save a search and get alerts", summary: "Be told when new matches appear.", keywords: ["alert", "notification", "saved search", "instant", "daily", "weekly"],
    body: [{ steps: ["Run a search.", "Tap Save search and choose how often: instantly, daily or weekly.", "New matches arrive in your notifications (the bell in the top bar)."] }, { note: "Alerts are in-app for now. Open Hodii to see them." }] },
  { id: "compare", audience: "user", category: "Saving and comparing", title: "Compare listings side by side", summary: "Up to four at once.", keywords: ["compare", "side by side", "tray"],
    body: [{ p: "Tap Compare on up to four listings. A tray appears at the bottom; open it to see price, size and features in one table." }] },
  { id: "contact-agent", audience: "user", category: "Contacting agents", title: "Contact an agent", summary: "Call, message or send an enquiry.", keywords: ["contact", "call", "phone", "whatsapp", "enquiry", "reveal"],
    body: [{ p: "Use the buttons on the listing. Phone numbers are shown on request, with a daily limit that protects agents from scraping; signing in raises your limit." }] },
  { id: "account", audience: "user", category: "Your account", title: "Manage or delete your account", summary: "Profile, password and deletion.", keywords: ["account", "profile", "password", "delete", "privacy", "data"],
    body: [{ p: "Open your profile to change details. To delete your account, use Delete account at the bottom: enter your password and type DELETE. Your data is removed and your feedback is anonymised. This cannot be undone." }] },
  { id: "safety", audience: "user", category: "Safety", title: "Stay safe from fraud", summary: "Never pay before you see the place.", keywords: ["fraud", "scam", "safety", "deposit", "report", "fake"],
    body: [{ bullets: ["Visit in person before paying anything.", "Be wary of prices far below the area average.", "Pay only to the verified owner or agency, not to a stranger.", "Use Report on any listing that looks wrong. We review reports."] }] },
  { id: "feedback", audience: "user", category: "Your account", title: "Report a problem or give feedback", summary: "The orange button on every page.", keywords: ["feedback", "bug", "broken", "down", "problem", "idea"],
    body: [{ p: "Hodii is still under development. Use the Feedback button at the bottom right of any page, pick a card (like, idea, confusing, bug, site down), and tell us more. Good or bad, we read everything." }] },

  // ---------- Agencies ----------
  { id: "agency-start", audience: "agency", category: "Getting started", title: "Set up your agency", summary: "From sign-up to your first listing.", keywords: ["agency", "setup", "create", "start", "register", "profile"],
    body: [{ steps: ["Sign in and choose List a property.", "Create your agency: name, county, phone, logo.", "Add your first listing. It goes live straight away."] }, { note: "You do not have to wait for verification to list." }], related: ["verification", "basic-limit"] },
  { id: "add-listing", audience: "agency", category: "Listings", title: "Add and edit a listing", summary: "Photos, price, features and publishing.", keywords: ["listing", "add", "photos", "images", "price", "edit", "draft", "publish"],
    body: [{ p: "Good photos and an honest price get the most enquiries. You can add up to 30 photos. Save as draft to finish later." }, { bullets: ["Listings last 90 days; renew before they expire.", "Pause a listing to hide it without losing it.", "Bulk actions handle up to 100 listings at once."] }] },
  { id: "basic-limit", audience: "agency", category: "Limits and paying", title: "The Basic listing limit", summary: "How many free listings you can have.", keywords: ["limit", "basic", "cap", "free", "space", "meter", "frozen", "freeze"],
    body: [{ p: "Free (Basic) listings are capped per agency, both live and in total. The meter on your overview and the Space page shows where you are. Boosted and Premium listings do not count." },
      { bullets: ["Over the cap? Oldest listings are frozen, never deleted.", "Freeze or delete one to make room, or Bring back a frozen one.", "A boost, a Premium slot or an extra-space pack also brings one back."] }, { note: "See the Pricing page for the current numbers." }] },
  { id: "boost", audience: "agency", category: "Limits and paying", title: "Boost a listing or buy Premium", summary: "Get seen more.", keywords: ["boost", "premium", "promote", "mpesa", "pay", "package", "slots"],
    body: [{ p: "Open Promote on a listing for a boost, or buy a Premium package for many listings at once. Pay with M-Pesa; the listing is promoted as soon as payment confirms. Paid listings get a ranking lift but never fill a whole results page." }] },
  { id: "space-pack", audience: "agency", category: "Limits and paying", title: "Buy extra Basic space", summary: "More free-style slots for a period.", keywords: ["space", "pack", "extra", "more listings"],
    body: [{ p: "On the Space page, buy a pack to raise your Basic cap for a set time. When it ends, listings above your cap enter the grace period and are then frozen if still over." }] },
  { id: "verification", audience: "agency", category: "Verification", title: "Get your agency verified", summary: "The badge and how long it takes.", keywords: ["verification", "verify", "verified", "badge", "documents", "approval", "pending"],
    body: [{ p: "Apply in Settings. While we review, you can keep listing and every listing goes live. Once approved, your verified badge appears on your profile and listings. Staff aim to answer within the target time shown in your banner." }] },
  { id: "team", audience: "agency", category: "Team and account", title: "Add teammates", summary: "Invite people and set roles.", keywords: ["team", "members", "invite", "roles", "staff"],
    body: [{ p: "Invite colleagues from the Team page. Members can manage listings; only owners change billing and settings." }] },
  { id: "leads", audience: "agency", category: "Team and account", title: "Read your enquiries and stats", summary: "Who is looking at your listings.", keywords: ["leads", "enquiries", "analytics", "stats", "views", "reveal"],
    body: [{ p: "The overview shows views, saves and enquiries. Reply fast: agents who answer within a day get most of the deals." }] },
];
