# Writing listings straight into MongoDB (scrapers and importers)

An importer writes to the `properties` collection directly. The site needs no other call: listings appear on search, the home page, saved-search alerts and price-drop notices on their own (see "What happens next").

## One-time setup
- Create an agency per source (for example "Hodii Imports – Source A") through the app, or insert it into `agencies`. Keep its `_id`, `slug` and the id of one `users` owner.
- Every document must follow `properties` in `mongodb/schema.json` (generated from `src/lib/mongodb/property-schemas.ts`). Apply the validators with `scripts/apply-mongodb-schema.ts` so MongoDB rejects bad documents instead of the site showing them.

## What a listing needs
- `_id`: a UUID string. `schemaVersion: 1`. `slug` (unique, lowercase, ends with a short id) and `referenceCode` (unique).
- `agencyId`, `agentId` (a member user id or null), `listingType`, `category`, `propertyType`, `title`, `description`, `price: { amount, currency, period }` and `price.amountKes` (the KES value used for sorting and filtering).
- `location`: `countyCode`, `county`, `areaSlug`, `areaName`, optional `subCounty`, and `point` as GeoJSON `{ type: "Point", coordinates: [lng, lat] }`.
- `images`: at least one `{ url, width, height, bytes, alt, position }`. **Linked images are fine**: use the source's URL as is. Width, height and bytes are required, so measure them while scraping.
- `status`: `"published"` to go live at once, or `"pending_review"` to wait for staff in the admin Moderation tab. When publishing also set `publishedAt`, `lastConfirmedAt`, `expiresAt` (90 days on) and `verified: { isVerified, verifiedAt }` to match the agency.
- `source: { kind, externalId, url }` so you can update and de-duplicate. Update an existing listing in place by `source.externalId`; set `updatedAt` on every change.

## Rules worth knowing
- The same index rejects a repeated `slug` or `referenceCode`.
- When the price changes, push the old value into `priceHistory` and set the new `price`. People who saved the listing are told about drops.
- To take a listing down, set `status` to `"closed"` (or `"expired"`) and `updatedAt`.
- An agency that later takes over an imported listing can keep, reorder and remove linked photos, but can only add new photos by uploading.

## What happens next (nothing for you to call)
- **Live site:** every visitor's page asks a cheap public "has anything changed?" question every 15 seconds, using the newest `updatedAt` among your listings. A change reloads the visible lists.
- **Saved searches:** each person's bell checks, at most every 5 minutes, for listings with `publishedAt` after their last alert that match each saved search, and notifies them.
- **Price drops:** the same check compares `price.amount` with the price the person saw when they saved the listing.
