# Hodii developer guide

Hodii is a Kenyan property marketplace: people search and compare listings, agencies list and promote them, staff moderate. This guide gets a new developer running and explains where things live and why. `AGENTS.md` holds the short rules; the other files in `docs/` go deep on one topic each.

## 1. Stack

| Part | Choice |
|---|---|
| App | TanStack Start (React 19, file-based routes, server functions) |
| Language | TypeScript, strict (`exactOptionalPropertyTypes` on) |
| Styling | Tailwind CSS 4 with shadcn-style components in `src/components/ui` |
| Data | MongoDB (driver 7), validators generated from Zod |
| Photos | Cloudinary, direct browser upload with server signatures |
| Payments | M-Pesa Daraja STK push |
| AI search | Groq, with several API keys rotated |
| Tests | Vitest (43 files, 320+ tests) |
| Hosting | Serverless (Cloudflare Worker target); no websockets, so live updates poll |

## 2. Run it

```sh
npm i
cp .env.example .env     # fill MONGODB_URI, COMMUNITY_ENCRYPTION_KEY, ADMIN_USERNAME, ADMIN_PASSWORD at minimum
npm run dev              # http://localhost:3000 (or the port Vite prints)
npx tsc --noEmit         # types
npx vitest run           # tests
npx vite build           # production build
```

Everything optional degrades quietly: no Cloudinary keys means no photo upload; blank `DARAJA_*` keeps payments off; no `GROQ_API_KEYS` hides AI search; no `ALERT_WEBHOOK_URL` means errors are only stored.

Environment variables are listed with comments in `.env.example`. `COMMUNITY_ENCRYPTION_KEY` encrypts enquirer contact details and comments: lose it and that data is unreadable, so back it up apart from the database.

### Database setup

```sh
bun scripts/generate-mongodb-schema.ts   # rebuilds mongodb/schema.json from the Zod schemas
bun scripts/apply-mongodb-schema.ts      # applies validators and indexes
```

Run the generator after any change to `src/lib/mongodb/property-schemas.ts` or `indexes.ts`. Application code and database validators share one source, so they cannot drift.

After adding or renaming a route file, regenerate the route tree: `node scripts/regen-routes.mjs`.

## 3. Map of the code

```
src/
  routes/            one file per page or API route (flat dotted names)
  components/        UI grouped by area: property, dashboard, admin, feedback, tour, help
  data/              static content: footer, info pages, guide articles
  lib/
    mongodb/         Zod schemas, taxonomy, limits, indexes, Kenya counties
    *.server.ts      server-only logic (database, secrets)
    *.functions.ts   createServerFn wrappers the browser calls
    *.ts             pure logic with tests (rank, basic-limit, revenue, tour, guide-search ...)
  test/              Vitest files
scripts/             schema generation, route regen, backup
docs/                topic notes (payments, search, data model, operations, importing)
```

### The server-function pattern

Every call from the browser goes through `createServerFn` in a `*.functions.ts` file:

1. `.inputValidator(...)` parses input with Zod. Never trust the browser.
2. The handler dynamically imports the `*.server.ts` module, so server code and secrets never reach the client bundle.
3. The first line of anything that touches a person's data is `requireUser()`, `requireMember(db, me, slug)` (agency) or `requireAdmin(role)` (staff).

Use `authDb`, `withDb` or `adminDb` for the database connection.

### Rules that matter

- **Brand, domain, legal entity** live only in `src/lib/brand.ts`.
- **Limits, property types and features** live in `src/lib/mongodb` and `settings-registry.ts`. Never hardcode them.
- **Admin-editable numbers** (prices, caps, SLAs) are in `src/lib/settings-registry.ts` and read with `getSettings()` (30 s cache). Add a setting there and it appears in the admin automatically.
- **Search state lives in the URL** (`search-url.ts`), so every search can be shared and bookmarked.
- **Phone numbers are never in page data.** `revealListingContact` fetches them on click and counts the reveal against a daily cap.
- **No email provider.** Sign-up is already confirmed and notifications are in-app only (`notifications.server.ts`, 90-day expiry).
- **Permissions** are in `src/lib/access.ts` (`can(role, "billing.manage")` and so on).

## 4. How the main features work

**Search and ranking.** `listing-search.ts` builds the MongoDB filter (token matching, synonyms in `synonyms.ts`, fuzzy fallback when nothing matches). `query-intent.ts` turns a sentence like "2 bedroom flat in Kilimani under 80k to rent" into filters, free and with no AI. `rank.ts` scores by relevance plus freshness plus a capped lift for paid listings, so payment can never fill a results page (`rank.maxPaidSharePct`). Details: `docs/search.md`.

**AI search.** `ai-search.server.ts` sends the text to Groq and validates the reply through `ai-criteria.ts` before it becomes filters. `key-pool.ts` rotates keys when one runs out. `ai-quota.ts` and `aiUsage` enforce per-window allowances by guest, user, agency and Premium.

**Promotion and the Basic limit.** Agencies list free up to a cap (`basic-limit.ts`, pure and tested). Boosts, Premium packages and space packs lift or raise it (`promotions.ts`, `packages.server.ts`, `basic-space.server.ts`). Over the cap, the oldest Basic listings become `frozen`, never deleted. Details: `docs/payments.md`.

**Payments.** `payments.server.ts` starts an STK push, the callback route `api.mpesa.callback.$secret.ts` settles it, and manual recording covers cash or missed callbacks. Refunds (`revenue.server.ts`) end the benefit that was bought. Revenue maths is pure in `revenue.ts`.

**Verification.** Agencies list immediately and listings go live. Verification only controls the badge. Staff queues flag requests older than `review.verifySlaHours` / `review.reportSlaHours` as overdue (`sla.ts`).

**Help, tour and feedback.**
- Guides: add an article to `src/data/guide.ts`; `guide-search.ts` indexes it.
- Tour: `lib/tour.ts` is a pure state machine (snooze 1, 1, 3, 7 days). `components/tour/tour-runner.tsx` draws it over `data-tour="..."` targets. Progress is kept in `localStorage` and, when signed in, in the `tourProgress` collection so it follows the person across devices.
- Feedback: `feedback.server.ts` (rate limit, honeypot), floating button on public pages, admin inbox.

**Analytics.** First-party only: page views, listing views, enquiries, phone reveals, and search words (no person stored, 120 days). Admin → Analytics.

**Voice search.** `voice.ts` (pure rules, tested), `voice.server.ts` (Groq Whisper through the shared `keyPool`, quota under subject `v:<who>` in `aiUsage`, refund on failure), `voice.functions.ts`, and `components/property/voice-button.tsx` (inside the search box). Settings: `voice.*` in the registry.

**Developments.** `developments.server.ts` / `developments.functions.ts`, public routes `developments.tsx` and `development.$slug.tsx`, dashboard route `dashboard.agency.$slug.developments.tsx`. Writes go through `developmentSchema.safeParse` before the database.

**Neighbourhoods.** `neighbourhood.ts` (pure rules, tested), `neighbourhoods.server.ts`, `neighbourhoods.functions.ts`, routes `neighbourhoods.index.tsx`, `neighbourhoods.compare.tsx`, `neighbourhoods.$county.$area.tsx`, UI in `components/neighbourhood/parts.tsx`. Keys are `county-slug/area-slug`.

**Neighbourhood moderation.** Signed-in people can report another person's review or chat message. Three different reporters hide it (`shouldHide` in `neighbourhood.ts`); staff see it under Admin, Reviews, and either keep it (clears reports) or remove it. Audit entries: `neighbourhood_item_removed` and `neighbourhood_item_restored`.

**Agency dashboard shell.** `dashboard.agency.$slug.tsx` is a sidebar layout (grouped links; a scrolling pill bar on phones). The overview in `dashboard.agency.$slug.index.tsx` draws its own SVG chart, with no chart library.

**Greetings.** `greeting.ts` picks Good morning (03:00 to 11:59), Good afternoon (12:00 to 16:59) or Good evening (17:00 to 02:59) from the person's own clock; `use-greeting.ts` shows "Hello" until the browser knows the time, so the server and browser output match. Agency dashboard stats are scoped by role: people with only `analytics.view.own` get the numbers of their own listings (`dashboard.server.ts`, `overview`).

**Layout.** Card grids use `repeat(auto-fill, minmax(…))`, and `styles.css` raises the root font size at 1920, 2560, 3200 and 3840 px so everything sized in rem scales on TVs. The List/Map pill is `view-pill.tsx`; card hover and map pins talk through `lib/hover-pin.ts`.

## 5. Testing

- Put pure logic in plain `.ts` files and test it in `src/test`. Most business rules are written this way on purpose.
- Anything that needs MongoDB is kept thin and typed; run it against a scratch database before release.
- Accessibility: run axe-core (WCAG A/AA, light and dark) over key pages with Playwright after big UI changes. The last audit had no violations.

## 6. Conventions

- Whole shillings (KES) everywhere; Nairobi calendar days (UTC+3) for reports.
- Dates in the database are BSON Dates; check expiry on each request (TTL cleanup is lazy).
- New collection: add its Zod schema, register it, add indexes, run the generator, and add deletion to `deleteUserData` if it holds personal data.
- Do not rewrite pushed git history (Lovable sync).
- Legal pages are drafts and need an advocate's review before launch.

## 7. Operations

Backups, restores, error alerts and staff two-step sign-in are in `docs/operations.md`. Importing listings straight into MongoDB is in `docs/importing.md`. Schedule `GET /api/cron/promotions` hourly with `Authorization: Bearer $CRON_SECRET`.

## 8. Known gaps

- Neighbourhood reports have no notification to staff; they appear under Admin, Reviews.
- Voice search has not been exercised against live Groq.

- No email or SMS provider: notifications are in-app only.
- No automatic M-Pesa reversal; refunds are recorded and the money is returned manually.
- Terms re-acceptance after a change is not built.
- The Python listing scraper is not built.
- Nothing has been exercised against live Safaricom, Cloudinary or Groq from the build environment; test those flows in a staging deployment first.

## Part 13k notes
- Theme is a cool blue (`#2563eb`, tokens in `src/styles.css`); the scrollbar uses blue-grey variables.
- Cards: `PropertyCard.more` holds up to 4 extra photos (card projection `$slice`), shown as a swipe strip with Instagram-style dots. The pill on the photo carries rank by colour only (Premium gold, boosted blue); the homepage has one "Top properties" section.
- Router pending state (`PageSkeleton`) shows card placeholders only on listing pages; every other page gets one centred loader. `EmptyState` is the shared empty design.
- Tour state carries `at` (ms); the newer of local and server wins, and `getTourProgress` is a POST so nothing caches it.
- Map: `RadiusEditor` (typed km, −/+, presets; 0.5–100 km) is shared by the map and the list view. Hover or tap the area for Adjust / Redraw / Remove; Adjust shows drag handles for the centre and the edge.
- Team page shows a role table built from `ACTION_GROUPS` + `ROLE_ACTIONS` in `lib/access.ts`.
