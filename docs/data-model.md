# Hodii data model

The property marketplace's MongoDB model. Source of truth in code: `src/lib/mongodb/` (`property-schemas.ts`, `taxonomy.ts`, `limits.ts`, `kenya.ts`, `property-rules.ts`, `indexes.ts`) and `src/lib/access.ts` for permissions. `mongodb/schema.json` is generated from them (`bun scripts/generate-mongodb-schema.ts`) and applied with `bun scripts/apply-mongodb-schema.ts`.

## Conventions
- `_id` is a UUID string; code exposes it as `id`. Dates are BSON Dates. Money is a whole number of shillings (`KES`) or dollars (`USD`).
- Personal data (an enquirer's email and phone) is stored encrypted (`emailEnc`, `phoneEnc`) with the existing AES-GCM helpers. Passwords are PBKDF2 hashes.
- Taxonomy keys (property types, features, statuses) are stored in documents and URLs: never rename a key, change its label.
- Every collection is validated by MongoDB (`validationAction: error`) and again by Zod in the application.

## Collections
| Collection | What it holds |
|---|---|
| `users` | Sign-in accounts (existing). New: `accountType` (`user` or `agency`) and optional `phoneEnc`. Older accounts without it count as `user`. |
| `agencies` | A listing company: name, kind, contact, address, service counties, EARB and business registration, verification state, suspension. Every listing belongs to one. |
| `agencyMembers` | Who belongs to an agency and as what (`owner`, `admin`, `agent`); also pending invitations and the public agent profile. |
| `properties` | A listing. |
| `developments` | New projects (off-plan or under construction) with unit types and a price range; listings can belong to one later. |
| `areas` | Normalised neighbourhoods per county, for search suggestions and area pages. |
| `enquiries` | Leads sent from a listing to its agency or agent. |
| `errorEvents` | Grouped errors for the admin Errors tab (60-day TTL). Written by the site only. |
| `enquiryMessages` | In-site replies on an enquiry (agent and enquirer). Only enquiries sent while signed in have a thread. The importer should not write here. |
| `savedProperties`, `savedSearches` | A person's favourites and their search alerts. |
| `listingReports` | Reports from the public ("looks like a scam", "no longer available"). |
| `propertyEvents`, `propertyDailyStats` | Raw activity (view, save, enquiry, phone reveal, …) and its daily rollup, for agency and admin analytics. |

## A listing (`properties`)
- **Identity**: `slug` (e.g. `3-bedroom-apartment-to-rent-kilimani-nairobi-hd-7k3m2q`), `referenceCode` (`HD-7K3M2Q`, readable over the phone), `agencyId`, `createdBy`, optional `agentId` (contact person) and the lister's own `externalRef`.
- **Source**: `source.kind` is `manual`, `import` or `scraper`; `source.url` and `source.externalId` let a scraper re-run without duplicates (a unique index on `(kind, externalId)` where an id exists).
- **Classification**: `listingType` (sale, rent, short_stay) → `category` (residential, commercial, land) → `propertyType` (27 types, each in one category).
- **Content**: `title` 10–100 characters, `description` 50–5000 characters (plain text), up to 6 `highlights` of 80 characters.
- **Price**: `amount`, `currency`, `period` (total for sale, month or year for rent, night or week for short stay), `negotiable`; `priceHistory` keeps the last 20 changes.
- **Location**: county (code 1–47), area, optional sub-county, address and landmark, an optional GeoJSON `point` (must be inside Kenya), and `hideExactLocation`.
- **Details**: bedrooms, bathrooms, en-suites, servant quarters, parking, floor area, plot area (entered unit plus square metres for filtering), floor level, floors, year built, condition, furnishing, zoning.
- **Legal and terms**: `legal` (title type, years left on a lease, title deed ready), `rental` (deposit months, minimum lease, service charge, included utilities, available from), `shortStay` (guests, minimum nights, check-in and out), `sale` (payment plans).
- **Features**: keys from the catalogue of 55 features in 8 groups (`taxonomy.ts`), restricted to categories where they make sense, plus up to 10 custom features.
- **Media**: `images` (1–30 to publish, the first is the cover; each at least 640×480, under 10 MB, https URL, alt text), up to 5 `floorPlans`, `videoUrl`, `virtualTourUrl`.
- **Nearby places**: `nearby` is an optional list of `{ category, name, distanceM }` written by the agent (categories: school, hospital, shopping, transport, food, worship, recreation, other; up to 6 per category and 24 in all). Shown on the listing page and searchable by name. Importers may set it when the source gives exact names and distances; never guess.
- **State**: `status`, `closedReason`, `moderation`, `verified` (checked by Hodii staff), `promotion` (`tier` and `until` summarise what is running; `boostUntil`/`boostPaymentId` and `premiumUntil`/`packageId`/`packagePaymentId` keep the raw ends and where each came from; always read the raw ends, never the summary, when deciding what is live), `stats` counters, `publishedAt`, `expiresAt` (90 days), `lastConfirmedAt`.

### Draft versus complete
A draft may be incomplete, so agents can save work. From `pending_review` onwards a listing needs a valid title and description, at least one photo, a price, a county and area, rooms for homes (zero bedrooms is fine for a bedsitter), and a size for land. The same rule is enforced in three places: `publishIssues()` in `property-rules.ts` (forms show what is missing), the Zod `propertySchema`, and a MongoDB guard that refuses any non-draft listing without `images.0`, `price.amount` and a county.

### Consistency rules (always enforced)
The property type must belong to the category; short stays only for places people sleep in; the price period must match the listing type; land has no bedrooms, bathrooms or floors; en-suites cannot exceed bedrooms; features must exist, apply to the category and not repeat; a closed listing says whether it was sold, let or withdrawn.

### Status lifecycle
`draft → pending_review → published → paused / expired / closed`, `rejected → draft`, `closed → draft` (relist). `canMoveStatus()` in `taxonomy.ts` holds the table. An agency that is **verified** publishes straight to `published`; others go to `pending_review` (`statusOnPublish()`); a suspended agency cannot publish.

## Accounts, agencies and dashboards
One sign-in per person. What they can reach follows from their memberships (`src/lib/access.ts`):

| Person | Dashboards |
|---|---|
| Normal user | Personal: saved homes, saved searches and alerts, enquiries sent |
| User who creates an agency later | Personal, plus the agency's dashboard as its **owner** |
| Agency sign-up | Lands on the agency dashboard; the personal one stays available |
| Invited colleague | The agency's dashboard with the role they were invited as |
| Hodii staff | The existing, separate admin sign-in |

Signing up as an agency creates the user, the agency and an `owner` membership. Any signed-in user can call `createMyAgency` (limit: 5 owned agencies). `getMe` now returns `accountType`, `agencies` (id, slug, name, role) and `dashboard` (the path to land on).

| Action | Owner | Admin | Agent |
|---|---|---|---|
| Create, edit and publish own listings | ✓ | ✓ | ✓ |
| Edit, assign and delete any agency listing | ✓ | ✓ | – |
| See and manage leads | all | all | assigned to them |
| Analytics | all | all | own listings |
| Invite and remove team members | ✓ | agents (and invite admins) | – |
| Change roles, delete the agency | ✓ | – | – |
| Edit agency profile, submit verification | ✓ | ✓ | – |

An agency always keeps at least one owner. Estate agencies and property managers need an EARB registration number before they can be marked verified.

## Limits
All limits live in `limits.ts`: title 10–100, description 50–5000, 1–30 photos, 5 floor plans, 40 features, price KES 1 to 100 billion, agency name 2–80, enquiry message 10–1000, 500 saved homes and 20 saved searches per person.

## Indexes
`indexes.ts` declares them next to the schemas, grouped by the query they serve: agency and agent dashboards, public search by county, type and area, newest and promoted listings, geo (`2dsphere`) and text search (title, area, description), expiry and moderation sweeps, scraper deduplication, and the lead, saved and analytics queries.

**Retention** matches the privacy policy: `enquiries` and `propertyEvents` expire after 24 months through TTL indexes.

## Applying it
1. `bun scripts/generate-mongodb-schema.ts` (only after changing a schema).
2. `MONGODB_URI=… MONGODB_DB=hodii bun scripts/apply-mongodb-schema.ts --dry-run` to see what it will do, then without `--dry-run`. It creates collections, sets validators and creates indexes; it never deletes data and is safe to re-run.
3. The `users` validator uses `validationLevel: moderate`, so accounts that predate the new fields stay valid.

## Notifications
`notifications`: per-person messages shown in the bell (`kind`, `title`, `body`, `link`, `inviteId` for team invitations, `dedupeKey`, `readAt`). They expire after 90 days. Saved searches keep `lastNotifiedAt`.

## Comments
`propertyComments` (encrypted text, parentId for replies, soft delete) and `propertyCommentLikes` (one per person per comment, with the comment author's id so likes received can be counted).

## Removed collections
The news site's collections (`articles`, `trends`, `sections`, `placements`, `reports`, `infoPages`, comments, likes, shares, `pageViews.articleSlug`) are no longer in the schema, indexes or code. They are not dropped from an existing database. Once you have no need for the old data, drop them yourself (`communityProfiles`, `communityComments`, `communityInteractions`, `communityCommentLikes`, `communityShares` too). `pageViews` stays: it feeds the admin's site traffic.

## Decisions to confirm
- **Billing**: `payments` records every attempt (boost or Premium package) with its price breakdown; `premiumPackages` holds bought packages and the listings attached to them. Plans: Basic (free, no badge), Boosted (per listing, per day), Premium (agency packages). Prices and limits are editable in admin Settings.
- **Scraped listings** need an owning agency. Suggested: a "Hodii Imports" agency per source, listings enter as `pending_review`, and real agencies can claim them later.
- **Hash salt** for emails in `auth.server.ts` uses the salt of the original database. Changing them invalidates existing email lookups, so do it only when the database starts fresh.

## Listing flow (Part 3)

- **Search** reads `properties` through `buildSearchFilter` (listing-search.ts). Only `published` listings whose `expiresAt` is in the future are public. Prices compare on `price.amountKes`.
- **Saving a listing** (`saveListing`): "draft" keeps incomplete work; "publish" runs `publishIssues`. A verified agency's listing goes live; an unverified agency's goes to `pending_review`; edits to a live listing stay live. Photos must come from the agency's own Cloudinary folder.
- **Moderation**: staff approve or reject `pending_review` listings, verify or reject agencies (the `verified` badge on each listing follows its agency) and act on `listingReports` (dismiss, pause or remove). A rejected listing shows the reason to its agent.
- **Contact details** are fetched on demand; each reveal is a deduplicated `propertyEvents` row and bumps `propertyDailyStats`.
- **Team**: there are no invitation emails yet. An owner or admin adds a person who already has an account, by email.

## payments
One attempt to pay for a boost (`kind: "boost"`, with `propertyId`) or a Premium package (`kind: "premium_package"`, with `slots` and later `packageId`): `agencyId`, `userId`, `days`, `amountKes`, `quote` (price breakdown at purchase), `callbackSummary`, `provider` (mpesa/manual), `status` (pending/paid/failed/cancelled/expired), `phoneHint` (last 3 digits), `checkoutRequestId`, `receipt`. Only a `paid` payment promotes the listing.

## premiumPackages
A bought Premium package: `agencyId`, `purchasedBy`, `paymentId`, `slots`, `days`, `priceKes`, `startsAt`, `endsAt`, `listingIds` (removal is instant and frees the slot), `renewedFrom`, and the expiry notices already sent. While a package runs, each attached listing has `promotion.premiumUntil = endsAt`.

## users (new fields)
`termsAcceptedAt`, `termsVersion`, `recoveryHashes` (digests of unused recovery codes), `recoveryIssuedAt`, `avatar`.

## agencyReviews
`agencyId`, `userId`, `username`, `rating` 1-5, `body`, `verifiedEnquirer` (the author had enquired with this agency), `reply {body, by, at}`, `reportedBy[]`, `status` visible/hidden. Unique per (`agencyId`, `userId`). The importer should not write here.

## agencies (new optional fields)
`tagline`, `story`, `services[]`, `hours`, `foundedYear`, `socials{facebook,instagram,x,tiktok,linkedin,youtube}`, `rating{count,avg}`. All optional, so imported agencies without them still validate.

## Basic limit additions
- `properties.status` has a `frozen` value, with `frozen: {reason: "owner"|"over_limit", at}`.
- `spacePacks`: bought extra Basic listing space (agencyId, slots, startsAt, endsAt, paymentId). Payments with `kind: "space_pack"` create one.
