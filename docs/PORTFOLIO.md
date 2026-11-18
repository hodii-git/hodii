# Hodii: a property marketplace for Kenya

*A complete case study and system walkthrough: what the product does, why each part works the way it does, and how it is built.*

---

## Contents

1. [The problem and the idea](#1-the-problem-and-the-idea)
2. [Who uses it](#2-who-uses-it)
3. [Product tour](#3-product-tour)
4. [How search works](#4-how-search-works)
5. [Listings: creating, publishing, expiring](#5-listings-creating-publishing-expiring)
6. [The business model: Basic, boosts, Premium and space](#6-the-business-model-basic-boosts-premium-and-space)
7. [Payments, refunds and revenue reporting](#7-payments-refunds-and-revenue-reporting)
8. [Agencies, teams, roles and verification](#8-agencies-teams-roles-and-verification)
9. [Enquiries and contact protection](#9-enquiries-and-contact-protection)
10. [Community: comments, reviews, reports](#10-community-comments-reviews-reports)
11. [Notifications and saved searches](#11-notifications-and-saved-searches)
12. [Staff tools: the admin dashboard](#12-staff-tools-the-admin-dashboard)
13. [Help, onboarding tour and feedback](#13-help-onboarding-tour-and-feedback)
14. [Analytics and measurement](#14-analytics-and-measurement)
15. [Accounts, security and privacy](#15-accounts-security-and-privacy)
16. [Architecture](#16-architecture)
17. [Data model](#17-data-model)
18. [Performance, SEO, accessibility, offline](#18-performance-seo-accessibility-offline)
19. [Quality: testing and tooling](#19-quality-testing-and-tooling)
20. [Operations](#20-operations)
21. [Key decisions and trade-offs](#21-key-decisions-and-trade-offs)
22. [Limits, gaps and next steps](#22-limits-gaps-and-next-steps)
23. [Glossary](#23-glossary)

---

## 1. The problem and the idea

Finding somewhere to live or work in Kenya usually means jumping between social media posts, agent WhatsApp groups and a few classified sites. The same problems recur:

- **Stale and fake listings.** A flat that was let months ago is still advertised. Photos are reused. Prices are bait.
- **Hidden cost.** A rent advert rarely mentions deposit, advance rent and agent fee, so the real move-in cost is a surprise.
- **Weak search.** People type how they talk ("bedsitter near Westlands under 15k") and get nothing, because systems expect exact keywords and exact filters.
- **Opaque agents.** There is no easy way to tell a long-standing agency from a one-day operator.
- **Pay-to-win fees.** Agents either pay for placement they cannot measure, or are priced out and ignored.

Hodii's idea is a marketplace that is **free to search, free to list up to a fair limit, and paid only for extra visibility**, with search that understands plain language, honest ranking that money cannot fully buy, and trust signals (verification, reviews, reports) that are visible but do not block honest agents from starting.

## 2. Who uses it

| Audience | What they want | What Hodii gives them |
|---|---|---|
| **Seekers** (tenants, buyers, short-stay guests) | Find a place that matches budget and area, compare, shortlist, contact safely | Natural-language and filtered search, map search, compare, saved homes, saved searches with alerts, calculators, safe contact flow |
| **Agencies and agents** | Put stock in front of buyers, measure interest, handle enquiries, look credible | Free Basic listings, boosts and Premium for visibility, team roles, enquiry inbox, analytics, verification badge, public profile |
| **Staff** | Keep the marketplace clean and the business healthy | Moderation queues with deadlines, agency verification, feedback inbox, revenue and search reports, settings that change prices and limits without a deploy |

One person has **one sign-in**. What they can reach is decided by their agency memberships: everyone gets the personal dashboard; each agency adds an agency dashboard with permissions set by role. Staff use a separate admin sign-in.

## 3. Product tour

### 3.1 Public side

- **Home.** Search box with plain-language understanding, showcase strips (boosted and Premium listings, newest, nearby), links to counties and areas.
- **Properties (`/properties`).** The main results page. Filters are dropdown "Pick" controls (nested, with Nairobi pinned first in county lists). Results update as you choose; there is no Apply button. Results load by infinite scroll. The whole search lives in the URL, so every search can be shared or bookmarked. A map mode supports circle and polygon search.
- **Listing page (`/property/<slug>`).** Gallery, price (with period: total, per month, per year, per night, per week), facts (beds, baths, parking, size, condition, year), features, highlights, nearby places, map, directions link ("Take me there"), agency card, enquiry form, phone reveal on click, comments, similar listings, more from this agency, and structured data for search engines.
- **Compare (`/compare`).** Up to four listings side by side. A tray at the bottom collects them while you browse.
- **Agencies (`/agencies`, `/agency/<slug>`).** A directory and a public profile with story, services, hours, team, reviews and the same search filters scoped to that agency.
- **Locations (`/locations/...`).** County and area landing pages for people (and search engines) browsing by place.
- **Tools (`/tools`).** Mortgage and affordability calculators, affordable rent, and a rent move-in cost calculator that adds deposit, advance rent and agent fee.
- **Pricing (`/info/pricing`).** The live price list, reading the same admin settings that the checkout uses.
- **Help (`/help`).** Two searchable guides (for seekers and for agencies) and the entry to the guided tour.
- **Feedback (`/feedback` and a floating button on every public page).**
- **Info pages.** About, standards, safety and fraud, buying and renting guides, contact, plus legal pages (terms, privacy, cookies).

### 3.2 Signed-in seekers

- **Saved (`/saved`).** Saved homes and saved searches, each search with a frequency: instant, daily, weekly or off.
- **Notifications (bell and `/notifications`).** Alerts for saved-search matches, price drops, replies, enquiry replies, listing decisions and more.
- **Profile.** Details, password, data download, recovery codes, email change, "your comments", and account deletion.

### 3.3 Agency dashboard (`/dashboard/agency/<slug>`)

Overview (views, enquiries, verification status, space meter), Listings (add, edit, pause, freeze, renew, bulk actions), Listing space (limit meter, extra-space packs), Premium (packages), Payments (receipts), Enquiries (inbox with threads and assignment), Team (invite, roles), Import (bulk upload), Agency settings (profile, branding, verification). Tabs appear only if the person's role allows them.

### 3.4 Admin dashboard (`/admin`)

Overview, Analytics, Moderation, Listings, Comments, Reviews, Payments, Agencies, Users, Site and security, Settings, Feedback, Errors, Activity, Team and My account. Each tab is gated by staff role (editor or admin). Details in section 12.

## 4. How search works

Search is the heart of the product and has four layers, from cheapest to most expensive.

### 4.1 Layer one: structured filters

Every filter maps to a MongoDB condition built in one place (`listing-search.ts`): listing type (sale, rent, short stay), category (residential, commercial, land), property types (28 of them, such as apartment, bedsitter, maisonette, warehouse, agricultural land), county (all 47), price range (with USD listings converted at a configured rate so they sort and filter fairly beside KES), bedrooms, bathrooms, features, furnishing, verified-only, plus circle and polygon geographic filters. Circles are at least 500 m wide so a hidden address cannot be pinpointed.

### 4.2 Layer two: understanding typed sentences (free, no AI)

`query-intent.ts` reads what people type and lifts the parts it is sure about into filters. For example:

> "2 bedroom flat in Kilimani under 80k to rent"

becomes: listing type *rent*, property type *apartment* (because "flat" is a known alias), bedrooms *2+*, maximum price *KES 80,000*, and keyword *kilimani*. The parser handles:

- **Money.** `80k`, `1.5m`, `1,200,000`, ranges ("between 50k and 90k", "50-90k"), and one-sided limits ("under", "below", "up to", "over", "at least"). A range counts as money only above KES 1,000, so "2-3 bedrooms" is not misread.
- **Rooms.** "3 bedroom", "3br", "three beds", "2 bathrooms".
- **Intent words.** rent, to let, lease; buy, for sale; short stay, Airbnb, per night.
- **Furnishing.** furnished, semi-furnished (matched before "furnished" so it is not misread), unfurnished.
- **Property types by name or plural**, longest names first.
- **Counties by name**, longest first ("Trans Nzoia" before "Nzoia").
- **Features** by label (borehole, gym, parking and so on).
- Whatever is left over ("kilimani") stays as the keyword search.

The result shows the person what was understood as removable chips, so a wrong guess is easy to undo. Because it is pure code, it works for everyone, always, and is unit-tested.

### 4.3 Layer three: keyword matching, synonyms and typo tolerance

Keywords are matched against title, area, county, property type, highlights, extra features, nearby place names and description. A synonym table (`synonyms.ts`) lets one word find its equivalents: flat and apartment; bedsit, bedsitter and "bed sitter"; maisonette spellings; SQ, DSQ and "servant quarter"; CCTV and "security camera"; borehole spellings; en-suite spellings; and similar. If an exact search finds nothing, a **fuzzy fallback** tolerates a one-letter slip and the page says it is showing close matches.

### 4.4 Layer four: AI search (optional, limited)

For harder sentences, an AI button sends the text to a large language model (Groq). The reply is **never trusted directly**: `ai-criteria.ts` validates it against the same schemas as normal filters before anything is applied, so a bad or malicious answer cannot produce an invalid query.

Practical protections:

- **Key rotation.** Several API keys can be configured. When one runs out of credit, the next is used (`key-pool.ts`), so the feature does not die at the worst moment.
- **Allowances.** Each person has a count per window (default 24 hours): 3 for signed-out visitors, 10 for signed-in accounts, 40 for agency members, 120 for Premium agency members. These numbers are admin settings. A countdown shows when the allowance refills. Normal search is never limited.
- **Switch.** Staff can turn AI search off entirely from settings.

### 4.5 Ranking

Ranking is deliberately explainable and capped, in one pure module (`rank.ts`):

```
score = text match (0 to 100; 50 when nothing was typed)
      + a small freshness bonus for new listings (for rank.freshDays days)
      + a capped lift for Boosted (default +12) or Premium (default +8) listings
```

Text match weights where the word was found: title 10, area 8, property type 5, county 4, highlights 4, extra features 4, place 3, nearby 3, description 2. For each typed word the best place counts, so a word in the title beats the same word buried in the description. Then a **page mixer** ensures paid listings never exceed `rank.maxPaidSharePct` (default 35%) of a page.

Two rules make it fair:

1. **Matching is a filter, not a score.** A listing that does not match the words never appears, however much was paid. The lift only reorders listings that already match.
2. **Paid share is capped.** A page always contains organic results, so seekers are not buried in adverts and agencies who do not pay still get seen.

The default sort is "Best match"; people can switch to newest, price and so on.

### 4.6 What people searched for

Each first-page search with words is counted by its words only (never the person or network address) in `searchTerms`, kept 120 days. Admin sees top searches and, more useful, **searches that found nothing**, which tells the business which areas, property types or synonyms to add.

## 5. Listings: creating, publishing, expiring

### 5.1 The six-step form

Agents create listings through a stepped form that keeps every step mounted so nothing typed is lost:

1. **Basics.** Listing type, category, property type, title, description.
2. **Price and place.** Price, currency (KES or USD), period (rules by type: sale is a total; rent is per month or year; short stay is per night or week), county, area, address, landmark, map position.
3. **Details.** Bedrooms, bathrooms, parking, floors, size, plot area, year built, condition, furnishing, features, highlights.
4. **Photos.** Direct browser upload to Cloudinary with server-made signatures. Minimum size 640×480, up to 30 photos, 10 MB each, alt text and captions, floor plans.
5. **Contact and nearby.** Contact person and number, and nearby places (schools, hospitals, shops and so on, up to 24, six per category, each with a distance).
6. **Visibility.** Choose Basic (free), a boost, or add to a Premium package. The draft is saved first so the price can be calculated for this property.

### 5.2 Rules that keep data clean

All limits are in one file (`src/lib/mongodb/limits.ts`): title 10 to 100 characters, description 50 to 5,000, up to 6 highlights, up to 40 features plus 10 custom, price from 1 to 100 billion, and so on. The forms, the server functions and the database validators all read the same constants, so a limit cannot be changed in one place and forgotten in another. Type-specific rules apply: room-based types (apartments, houses and so on) must state bedrooms and bathrooms; bedsitters and studios may state zero bedrooms; short stays are allowed only for places people can sleep in. At the database level, anything that leaves draft must have a photo, a price and a county, whatever code wrote it.

Photos are protected too: a save can keep photos already on the listing from any host (imported listings), but any photo **added** in that save must be a direct upload into the agency's own Cloudinary folder. This stops hot-linking other people's images.

### 5.3 Status lifecycle

`draft` → `published` → (`paused` by owner, `frozen` for the Basic limit, `expired` after 90 days, `rejected`/removed by staff). Listings last **90 days** and must be renewed; the owner is notified 7 days before expiry and when it expires. Renewing resets the clock.

### 5.4 Bulk operations

Agencies can bulk upload listings (CSV and file import with validation and per-row error reports), bulk edit, and bulk change status, up to 100 at a time, with safer deletes. Staff have bulk actions and CSV export with emails excluded.

### 5.5 Importers

A separate path lets trusted importers write straight to MongoDB (documented in `docs/importing.md`). Such listings are covered by the same sweeps (alerts, expiry). A listing scraper in Python is planned but not built.

## 6. The business model: Basic, boosts, Premium and space

Hodii earns only from **visibility and room**, never from access. Every number below is an admin setting, so the business can tune it without a code change, and the public Pricing page always shows the live values.

### 6.1 Basic (free)

Every agency can have a limited number of **live Basic listings** (default 10) and a limit on **Basic listings stored in total** including drafts, paused and frozen ones (a storage guard). Boosted and Premium listings do not count toward these caps.

### 6.2 Boosts (one listing)

A boost lifts a single listing and places it in boosted strips for a chosen number of days (default 7, up to 365). The price is computed on the server from:

```
price = daily rate (by county demand)
      × value multiplier (by price band)
      × days
      then a discount for longer runs, rounded to the nearest KES 10, never below the minimum
```

- **Demand tiers.** Nairobi, Mombasa and Kiambu are high (default KES 60/day); Kajiado, Machakos, Nakuru, Kisumu, Uasin Gishu and Laikipia are mid (KES 40/day); everywhere else is base (KES 25/day).
- **Value multiplier.** Higher-priced properties earn the agency more, so they pay more; cheap ones pay less. For rent: ×0.8 under KES 15,000, ×1 up to 60,000, ×1.25 from 60,000, ×1.5 from 150,000. Sale and short-stay have their own bands because the amounts differ by orders of magnitude.
- **Duration discounts.** 10% from 14 days, 25% from 30 days, 40% from 90 days.
- **Worked example.** A KES 80,000 per month flat in Nairobi, boosted 30 days: daily 60 × 1.25 = 75; × 30 = 2,250; less 25% = 1,687.50; rounded to the nearest 10 = **KES 1,690**.

### 6.3 Premium packages (many listings)

A package (default KES 15,000 for 30 days) lifts a set number of listings (default 10 slots). More slots cost extra each (default KES 1,000 per extra slot, up to 200). Listings in the package are Premium: they rank higher (a lift of 8 by default), do not count toward the Basic cap, and their agency members get a larger AI allowance. Agencies assign and remove listings from a package, and are warned before it ends (default 3 days).

### 6.4 Extra Basic space

An agency that simply needs more free-style listings can buy an **extra-space pack** (default KES 1,500 for 10 extra Basic listings for 30 days) instead of boosting each one.

### 6.5 The limit, freezing and the grace period

The rule is a pure module (`basic-limit.ts`) with tests:

- Only **Basic** listings are counted.
- When a boost or package ends, the listing stays visible as Basic for a **grace period** (default 3 days).
- After that, if the agency is over its cap, the **oldest** listings are **frozen**: hidden from search but never deleted.
- A frozen listing returns when the agency frees space (freeze or delete another), or buys a boost, a Premium slot, or an extra-space pack. Paying for a boost on a frozen, draft or expired listing makes it live immediately.
- Owners can freeze a listing themselves at any time to make room.

This design avoids two failures: agencies feeling locked out, and storage growing without bound. A meter in the dashboard shows usage against the cap, and the Pricing page explains the rules in plain words.

### 6.6 Why not just charge for listing?

Charging to list pushes small honest agents away and fills the site with fewer, staler listings. Charging for attention aligns the business with outcomes: agencies pay when visibility is worth it to them, and seekers always see a full, honest marketplace.

## 7. Payments, refunds and revenue reporting

### 7.1 M-Pesa flow

Payments use Safaricom's Daraja STK push:

1. The agency chooses what to buy and enters a phone number.
2. The **server** recomputes the price (never trusts the browser) and creates a `payments` record in `pending`.
3. An STK push prompts the phone for the M-Pesa PIN.
4. Safaricom calls a **secret-protected callback URL**; the handler validates it and **settles** the payment: marks it paid, stores the receipt code, and applies the benefit (boost, package, space pack, or publishing a draft or frozen listing).
5. Meanwhile the browser polls payment status for a live "waiting for payment" UI.

Settlement is idempotent, so a repeated callback cannot double-apply. Manual recording (admin) covers cash payments or missed callbacks. Payments are off until Daraja keys are set.

### 7.2 Refunds

Staff can mark a paid payment **refunded** with a required note. The system then **ends what was bought**: the boost (only if that payment was the latest one extending it), the Premium package (its listings fall back to Basic), or the extra space. It then re-applies the agency's limits. The money itself is returned by M-Pesa reversal outside the site; the system keeps books and benefits honest. Calling refund twice is harmless.

### 7.3 Revenue reporting

The admin Payments tab shows, for 7, 30, 90 or 365 days: **net** (gross minus refunds), **gross**, **refunded**, **average sale**, a daily chart in Nairobi calendar days, revenue **by product** and **by top agencies**, and a **"waiting over 30 minutes"** list of pending payments that never resolved (a prompt that may have taken money). CSV export includes kind, agency, paid date, refund date and note. The maths is pure (`revenue.ts`) and tested.

### 7.4 Agency receipts

Agencies with billing access see a Payments tab listing paid and refunded payments with date, product, M-Pesa receipt code and amount, with a Print button that doubles as "save as PDF".

## 8. Agencies, teams, roles and verification

### 8.1 Roles

Three roles with explicit permissions (`access.ts`):

| Role | Can do |
|---|---|
| **Agent** | Create and edit own listings, publish, see and manage leads assigned to them, see own analytics |
| **Admin** | Everything an agent can, plus edit any listing, delete, assign leads, manage developments, see all leads and analytics, invite and remove agents, edit agency, submit verification, manage billing |
| **Owner** | Everything an admin can, plus change roles and delete the agency |

Rules protect the agency: only owners invite owners; admins can remove agents only; an agency always keeps at least one owner; nobody removes an owner through the normal remove path. The same permission functions decide which buttons the UI shows and which server calls are allowed, so they cannot disagree.

### 8.2 Teams and invitations

Existing accounts receive an invitation in their notification bell and accept or decline. An email with no account yet keeps the pending invitation (the address is stored encrypted), and it reaches the person at sign-up. Pending invitations count toward the team limit (up to 50 members) and can be cancelled.

### 8.3 Verification without blocking

An important product decision: **agencies can list immediately.** Every active agency's listing goes live straight away. Verification only controls the **verified badge** and the "verified only" filter. While a request is pending the agency sees a "verification in progress" message with a spinner; after approval the badge appears on their profile and listings. Staff see verified or not, and a staff queue flags requests older than a target (default 48 hours) as **overdue**. Suspended agencies cannot publish.

This removes the single biggest onboarding hurdle (waiting for approval) while keeping a strong trust signal and a safety net: staff take down bad listings after the fact through reports and moderation.

### 8.4 Agency profile

Name, tagline, story, services (up to 12), hours, founded year, socials, logo and cover images, service areas, and a rating computed from reviews.

## 9. Enquiries and contact protection

- **Enquiry form.** A seeker sends a message from a listing. It becomes a **lead** with a thread. Agency staff with permission see all leads or just their assigned ones, reply, and change status. Seekers see replies in their notifications.
- **Encrypted contact details.** Enquirer emails and phone numbers are encrypted at rest (AES-256-GCM) with a key held outside the database.
- **Phone reveal on click.** Phone numbers are never in page data. A server call fetches the number when someone taps "show number", and that call both counts the reveal for analytics and enforces a **daily cap** per visitor (default 10 signed out, 40 signed in) and per network (120), so scrapers cannot harvest numbers. Limits are admin settings. Reveal events carry a hashed network address, never the raw one.
- **Teams.** Leads can be assigned to a teammate, who is notified.

## 10. Community: comments, reviews, reports

### 10.1 Listing comments

Threaded comments (up to three levels of replies) with likes, editing within 30 minutes, soft delete, 1,000 characters, a cap of 30 per listing and a burst limit (5 per minute). Text is **encrypted at rest**. A site switch can turn comments off. Staff (editors) can remove comments. Account deletion blanks a person's comments.

### 10.2 Agency reviews

One review per person per agency, editable, 5 new reviews per day, with agency staff blocked from reviewing their own agency. Owners and admins can reply once. **Three reports hide a review** pending staff action. The agency's rating `{count, average}` is recomputed on every change.

### 10.3 Listing reports

Anyone can report a listing. Reports enter the staff queue with a response target (default 24 hours) and are flagged overdue if they wait longer.

## 11. Notifications and saved searches

Notifications are **in-site only** (the bell and `/notifications`); nothing is emailed because no email provider is connected. Kinds include: invitation, enquiry, listing decision, agency decision, saved search, price drop, comment reply, comment on listing, comment like, listing expiry, agency review and promotion. Each has a dedupe key so the same event never notifies twice, and notifications expire after 90 days.

**Saved-search alerts work without a background server.** Because the host is serverless, a *lazy sweep* runs when a signed-in person's bell is checked: it finds new listings matching each saved search since it last ran, respecting the chosen frequency (instant, daily, weekly), and creates a notification such as "5 new properties match 'Kilimani 2BR'". Price drops on saved homes work the same way. Because it reads the database rather than relying on write hooks, listings written by importers are covered. An hourly cron endpoint handles promotion and expiry notices.

## 12. Staff tools: the admin dashboard

The admin area has its own sign-in (separate from user accounts), roles (**editor** and **admin**), optional **two-step sign-in** (authenticator app plus eight one-time backup codes; can be forced for everyone with an environment flag), and an **activity log** of staff actions.

- **Overview.** Live counts, with the sidebar showing a live badge for work waiting in Moderation and the browser tab title carrying the number.
- **Analytics.** The marketplace funnel, time series, top listings and agencies, search terms, and site traffic.
- **Moderation.** Pending listings (legacy), agency verification requests, and reports, each with a "waiting X, overdue" chip using the configured targets.
- **Listings, Agencies, Users.** Search, filter, bulk actions, suspend, reset password, CSV export (emails never included).
- **Comments and Reviews.** Remove or restore.
- **Payments.** Revenue, refunds, manual recording, stuck payments (section 7).
- **Settings.** Every price, cap, limit, AI allowance, ranking weight and deadline is edited here, grouped and validated (min, max, units). Changes apply within 30 seconds (cache). A cross-check rejects inconsistent combinations.
- **Feedback.** An inbox of what visitors sent, with status (new, seen, resolved) and notes.
- **Errors.** Grouped server and browser errors with counts and stack traces, messages scrubbed of emails, phone numbers and tokens, kept 60 days; optional webhook alert to Slack, Discord or Teams.
- **Site and security.** Maintenance switch, comment switch and related protections.
- **Team and My account.** Staff accounts, roles, 2FA.

## 13. Help, onboarding tour and feedback

### 13.1 Searchable guides

Articles are structured data (`data/guide.ts`) in two audiences. The search (`guide-search.ts`) runs in the browser: every typed word must be found somewhere; title matches score highest, then keywords, summary and body; plurals are folded and one-letter typos tolerated. Results can be filtered by audience. Articles link to related articles and to the Pricing page.

### 13.2 Guided tour

A pure state machine (`tour.ts`) with states *new, running, paused, snoozed, dismissed, done*. Behaviour:

- A calm prompt appears (never on admin, sign-in or form pages): **Start tour**, **Remind me tomorrow**, **Don't show again**.
- "Remind me" escalates: **1, 1, 3, then 7 days**, then stops asking.
- During the tour a spotlight highlights real parts of the page (found by `data-tour` attributes) with Back, Next, **Pause**, remind-me-later and don't-show-again. Escape pauses; a small "Tour paused, Resume" chip stays.
- Separate tours exist for **seekers** (search, list a property, notifications, account, feedback) and **agencies** (overview, listings, listing space, premium, enquiries, agency settings, feedback).
- **Progress is saved per person on the server** (`tourProgress`), so it follows them to any device, and also cached in the browser for guests. It can be restarted from the Help page.

### 13.3 Feedback

A floating bottom-right button on every public page opens a dialog that states plainly that **the platform is still under development** and that good and bad feedback are both welcome. Quick-select cards cover: something I like, an idea, something confusing, a bug or something broken, the site is down or very slow, and other. It captures page and device for context, an optional star rating, and an optional contact opt-in. Abuse protection: a hidden honeypot field and a limit of 8 submissions per hour per network (hashed). Staff triage in the admin inbox. Account deletion anonymises a person's feedback.

## 14. Analytics and measurement

All analytics are **first-party**: no third-party tracker is required (Google Analytics can be added by setting an ID).

- **Funnel per listing.** Impressions → views → unique views → saves → enquiries → phone reveals → WhatsApp clicks, stored as daily counters (`propertyDailyStats`) and raw events (`propertyEvents`, short retention).
- **Agency view.** Each agency sees performance for its own listings.
- **Staff view.** Market funnel, top listings and agencies, site traffic.
- **Search analytics.** Top searches and zero-result searches (section 4.6).
- **Revenue analytics.** Section 7.3.
- **Privacy.** Network addresses are only ever stored as hashes for rate limits and counting; search words carry no person.

## 15. Accounts, security and privacy

### 15.1 Sign-up and sign-in

Sign-up runs only through a server function that creates an already-confirmed account (no email is ever sent), with per-address attempt limits. Usernames are unique ignoring case (a collated index). Sign-in is email and password only; social providers are intentionally disabled because account data must live in the app's own database. Passwords are hashed with PBKDF2 (salted, many iterations) with a minimum of 10 characters. Sessions are **HttpOnly, Secure cookies** and expire after 30 idle days, with expiry checked on every protected request (TTL clean-up is asynchronous, so the app does not rely on it).

### 15.2 Account recovery without email

Because there is no email provider, recovery uses **one-time recovery codes** generated at sign-up (stored only as digests), with regeneration and email-change flows. Staff can reset a user's password.

### 15.3 Account deletion

Deleting an account requires the **password** and typing **DELETE**, with a limiter that locks after 5 wrong tries for 15 minutes. It refuses if the person is the only owner of an agency (they must transfer ownership first). Deletion removes personal data and notifications and the tour progress, blanks comments, anonymises feedback, and unlinks enquiries. The privacy policy promises deletion within 30 days including backups.

### 15.4 Request protection

A protection layer runs before the app (`protection.ts`): blocks probe and scanner paths (`.php`, `.env`, `wp-admin`, path traversal and similar), known attack-tool user agents, caps URL length and body size (1 MB), applies per-visitor rate limits (reads, writes and a stricter auth limit) with escalating temporary bans, allows known good search crawlers, and sets security headers and cache headers. It is per server instance and complements the hosting edge's flood protection.

### 15.5 Data protection

- Sensitive fields encrypted at rest (enquirer contact details, comments, pending invitation emails) with AES-256-GCM.
- Staff CSV exports never include emails.
- Contact reveal caps against scraping.
- Users can **download their data** (password required) as JSON.
- Legal pages (terms, privacy, cookies) are Kenya-specific drafts and require advocate review before launch.

## 16. Architecture

### 16.1 Stack

TanStack Start (React 19) with file-based routes and server functions; TypeScript in strict mode; Tailwind CSS 4 with shadcn-style components; MongoDB with validators generated from Zod; Cloudinary for images; M-Pesa Daraja; Groq; Vitest; Playwright and axe-core for audits. It builds for a serverless (Cloudflare Worker) target.

### 16.2 The server-function pattern

Every browser-to-server call goes through `createServerFn`:

1. **Validate** input with Zod (`inputValidator`); never trust the browser.
2. **Dynamically import** the `*.server.ts` module so secrets and database code never reach the client bundle.
3. **Authorise first**: `requireUser()`, `requireMember(db, me, slug)` for agency work, or `requireAdmin(role)` for staff.
4. Run the business logic against the database through `authDb`, `withDb` or `adminDb`.

Pure business rules live in plain `.ts` files (ranking, limits, pricing, revenue, SLAs, tour, guide search, query understanding) with no database access, so they are fast to test and easy to reason about. Thin server modules call them.

### 16.3 One source of truth

- **Schemas.** A single Zod definition per collection produces the TypeScript types, the MongoDB `$jsonSchema` validator, and the index list (`scripts/generate-mongodb-schema.ts`). Application and database cannot drift.
- **Limits and taxonomy.** One file each; forms, server and database all import them.
- **Settings.** `settings-registry.ts` declares every admin-editable number with group, label, type, bounds and default; the admin Settings screen and the Pricing page are generated from it.
- **Brand.** Name, domain, legal entity and mailboxes live only in `brand.ts`.

### 16.4 Live updates on serverless

Without websockets, the app uses **polling with cache help**: a tiny "live stamp" endpoint (cached for a few seconds at the edge) is polled every 15 seconds and triggers list refreshes when it changes; the bell polls every 30 seconds, comments every 20 seconds, and dashboards every 30 seconds.

### 16.5 Background work without a worker

There is no always-on process. Periodic work happens (a) **lazily**, triggered by user activity (saved-search sweeps, space-pack sweeps, listing expiry checks), and (b) by an **hourly cron endpoint** secured with a bearer secret for promotion-end and expiry notices.

### 16.6 Route map

Public: `/`, `/properties`, `/property/<slug>`, `/agencies`, `/agency/<slug>`, `/compare`, `/tools`, `/locations`, `/locations/<county>`, `/locations/<county>/<area>`, `/section/<slug>`, `/info/<slug>`, `/info/pricing`, `/help`, `/help/<id>`, `/feedback`, `/list-property`, `/auth`. Signed-in: `/dashboard`, `/saved`, `/profile`, `/notifications`, `/dashboard/agency/<slug>/...`. Staff: `/admin`. System: `/sitemap.xml`, `/sitemaps/<name>`, `/api/cron/promotions`, `/api/mpesa/callback/<secret>`.

## 17. Data model

Twenty-seven collections, each with a Zod schema, a database validator and indexes:

| Area | Collections |
|---|---|
| People and agencies | `users`, `agencies`, `agencyMembers` |
| Listings | `properties`, `developments`, `areas` |
| Leads | `enquiries`, `enquiryMessages` |
| Saved and alerts | `savedProperties`, `savedSearches`, `notifications` |
| Money | `payments`, `premiumPackages`, `spacePacks` |
| Community | `agencyReviews`, `propertyComments`, `propertyCommentLikes`, `listingReports` |
| Measurement | `propertyEvents`, `propertyDailyStats`, `searchTerms`, `aiUsage` |
| Support and quality | `feedback`, `tourProgress`, `errorEvents` |

Notable design points:

- **Promotion state on the listing.** A listing stores `promotion {boostUntil, premiumUntil, packageId, boostPaymentId}` plus a derived summary, so "what tier is it right now" is a cheap check and ranking never has to join payments.
- **TTL indexes** expire sessions, rate-limit counters, notifications (90 days), search terms (120 days), error events (60 days) and raw events, with expiry also checked in code because TTL clean-up is lazy.
- **Guards the schema language cannot express** (for example "anything that is not a draft must have a photo and a price") are added as extra validator rules.
- **Soft rules in code, hard rules in the database.** Cross-field rules run in code; structural rules are enforced by MongoDB even if a script writes directly.

### 17a. Late additions: voice search, developments, neighbourhoods

**Voice search.** A microphone inside the search box records up to 20 seconds in the browser (`MediaRecorder`), sends it as base64 to `transcribeVoice`, and `voice.server.ts` calls Groq Whisper (`whisper-large-v3-turbo`) with a short hint of Kenyan place names. It shares the AI key pool and the `aiUsage` counter, under its own subject (`v:`) so voice has its own allowance per tier (visitor 3, member 10, agency 40, Premium 120 per window, all editable in admin settings). A search that fails on our side is refunded; the browser retries dropped connections three times; a refusal (limit, nothing heard, unreadable audio) is shown at once. Typing always still works. Pure rules (accepted formats, size, filler such as "thank you" for silence) live in `voice.ts` and are tested.

**Developments.** The `developments` collection (already in the data model) now has pages: `/developments` (search by project, county and stage, with "upcoming" covering planning, off-plan and under construction), `/development/$slug` (gallery, unit-type table, features, brochure, the selling agency) and a Developments tab in the agency dashboard for people with the `development.manage` permission (owners and admins). Projects from suspended agencies are hidden. The footer's "New developments" link opens `/developments`.

**Neighbourhoods.** A neighbourhood is any area with a live listing. Members rate seven things (security, amenities, transport, quietness, water and power, family life, value) from 1 to 5, one review per person per area, with an optional text. Averages, a small-sample-safe ranking and the filters are pure functions in `neighbourhood.ts`. `/neighbourhoods` lists and filters (county, overall rating, "strong in" an aspect, sort), `/neighbourhoods/compare` puts up to three side by side with average rent and sale price, and each area page has the ratings, the reviews and a threaded group chat (encrypted at rest, burst-limited, three levels deep, authors can delete their own). Two collections back it: `neighbourhoodReviews` and `neighbourhoodPosts`. Account deletion removes a person's reviews and blanks their chat posts; the data export includes both.

## 18. Performance, SEO, accessibility, offline

### 18.1 Performance

Infinite scroll with small first pages; lazy, async-decoded images with fixed dimensions (no layout shift) and a high-priority first gallery image; cached public pages (`cachePublic` marks responses for edge caching and the server turns it into headers, only for safe, public routes); settings cached 30 seconds; AI and search results are cheap by default (the free parser and keyword search do the work); sitemaps are split into files of at most 5,000 URLs so none approaches the 50,000-URL limit and one slow query cannot break all of them.

### 18.2 SEO

Every content route sets a self-referencing canonical link; property pages emit structured data matching what is visible; location landing pages target "homes in <area>" searches; sitemap index with chunked listing sitemaps; `robots.txt`; dashboard and account pages are marked `noindex`.

### 18.3 Accessibility

Automated axe-core audits (WCAG 2 A, AA and 2.1 AA plus best practices) in **light and dark** over the main public pages return no violations after fixes. Specifics: skip-to-content link; labelled form controls and search fields; table captions and header scopes; live regions for results and status; keyboard-operable dropdowns and dialogs; visible focus; the tour never traps focus and can be paused with Escape; colour contrast checked in both themes; respects user theme (light by default, dark available).

### 18.4 Offline and installable

A web manifest and service worker with an offline page let the site be installed and degrade gracefully with no connection.

## 19. Quality: testing and tooling

- **43 test files, 320+ tests** on pure logic: query understanding, ranking, pricing, basic-limit and freezing choice, revenue maths, SLA labels, tour state machine, guide search, synonyms, search URL round-tripping, CSV and bulk parsing, sitemap generation, calculators, TOTP, recovery codes, key rotation, AI quota, error grouping and more.
- **Type safety.** Strict TypeScript including `exactOptionalPropertyTypes`, checked on every change.
- **Build check.** A production build is run before each delivery.
- **Accessibility audit.** axe-core through Playwright in both colour schemes.
- **Generated artefacts.** Route tree and database schema are regenerated by scripts, never hand-edited.
- **Honesty about gaps.** The payment, image upload and AI integrations have been built to spec and unit-tested at the logic level but not exercised against live accounts from the build environment; this is listed explicitly in the next section.

## 20. Operations

- **Backups.** Use the host's point-in-time backups first; also a script makes compressed dumps and keeps the newest 14; archives contain personal data and are stored encrypted; the encryption key is backed up separately; restores are tested quarterly.
- **Alerts.** Errors are grouped and optionally posted to a chat webhook (first occurrence and at most hourly afterwards). Uptime monitoring is recommended externally because a dead site cannot report itself.
- **Staff security.** Optional forced two-step sign-in for every staff account.
- **Cron.** One hourly authenticated endpoint.
- **Configuration.** Environment variables for database, encryption key, admin credentials, Cloudinary, Daraja, Groq keys, alert webhook, cron secret; everything optional degrades quietly (no keys, no feature).

## 21. Key decisions and trade-offs

| Decision | Reason | Trade-off |
|---|---|---|
| Verification does not block listing | Removes onboarding friction; trust shown by badge | Bad listings can appear briefly; mitigated by reports and takedowns |
| Freeze, never delete, over-limit listings | Agencies are never locked out; storage stays bounded | Needs clear messaging and a meter (provided) |
| Pure functions for all business rules | Easy, fast tests; behaviour explainable to agencies | Slightly more files |
| One Zod schema generates types and DB validators | No drift | Needs a generate step after schema changes |
| Free text understanding before AI | Free, instant, works for everyone | Handles common phrasing only; AI covers the rest |
| Paid share capped in ranking | Keeps results useful and agencies fair | Caps revenue per page; tunable in settings |
| In-app notifications, no email | No provider dependency; privacy | People must open the site to see alerts |
| Recovery codes instead of email reset | Works with no email system | Users must store their codes |
| Polling instead of websockets | Fits serverless hosting | Updates are seconds, not instant |
| Lazy sweeps plus one cron | No worker to run | Alerts fire when someone is active or cron runs |
| Settings in the database | Business tunes prices without deploys | Cache means up to 30 s to take effect |
| Tour progress per account | Follows users between devices | One small extra collection |

## 22. Limits, gaps and next steps

**Not built yet:** email and SMS delivery; automatic M-Pesa reversals (refunds are recorded and the money is returned manually); re-acceptance of changed terms; the Python scraper for importing listings from public sources; push notifications.

**Not verified in the build environment:** live M-Pesa (Safaricom), Cloudinary uploads and signatures, Groq AI calls, a real MongoDB cluster under load, and real-device mobile testing. These need a staging run before launch.

**Legal:** terms, privacy and cookie pages are drafts and need an advocate's review.

**Next steps:** a staging deployment with live keys and a test script for each integration; email and SMS alerts; automated reversals; the importer; richer agency analytics; neighbourhood price trends from the data the platform collects.

## 23. Glossary

- **Basic listing.** A free, unpromoted listing, counted against the agency cap.
- **Boost.** A paid, time-limited lift for one listing.
- **Premium package.** A paid, time-limited lift for many listings, which also keeps them out of the Basic cap.
- **Space pack.** A paid, time-limited increase of the Basic cap.
- **Frozen.** A listing hidden because the agency is over its Basic cap; kept, never deleted, restorable.
- **Grace period.** Days a listing stays visible as Basic after its boost or package ends.
- **Lazy sweep.** Background work run when a user acts, rather than by an always-on worker.
- **STK push.** The M-Pesa prompt that appears on a phone asking for a PIN.
- **SLA / target.** The time staff aim to answer a request within; overdue items are flagged.
- **Honeypot.** A hidden form field that only bots fill, used to drop spam.
- **TTL index.** A database index that deletes documents automatically after a time.
- **Canonical link.** A tag telling search engines which URL is the main copy of a page.
