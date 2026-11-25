# Running Hodii: backups, restores, alerts and staff sign-in

## Backups

The database is the one thing that cannot be rebuilt. Photos live in Cloudinary and the code lives in git.

1. **Use the host's backups first.** On MongoDB Atlas turn on Cloud Backup (continuous or daily snapshots). That is the main safety net and allows restoring to a point in time.
2. **Keep your own copy as well.** `scripts/backup.sh` writes a compressed `mongodump` archive and keeps the newest 14:

   ```
   MONGODB_URI=... MONGODB_DB=hodii ./scripts/backup.sh /secure/backups 14
   ```

   Run it daily from cron or a scheduled CI job, and copy the archives off the machine (another cloud account or bucket). It leaves out sessions, page views and raw activity events, which are not worth restoring.
3. **The archives contain personal data** (enquirer emails and phones are encrypted with `COMMUNITY_ENCRYPTION_KEY`; usernames, reviews and listings are not). Store them encrypted, restrict who can read them, and delete old ones. The privacy policy promises deletion within 30 days of a deleted account: backups older than 30 days should not be kept beyond what you need, so keep 14 to 30 days.
4. **Back up the encryption key.** Encrypted fields cannot be read without the key set in your environment (see `.env.example`). Keep a copy in a password manager, separate from the database backups.
5. **Test a restore.** Once a quarter, restore the newest archive into a scratch database and open the site against it:

   ```
   mongorestore --uri="$SCRATCH_URI" --gzip --archive=hodii-....archive.gz --nsFrom='hodii.*' --nsTo='hodii_restore.*'
   ```

   A backup you have never restored is a hope, not a backup.
6. **Photos.** Cloudinary keeps originals. Enable its backup add-on if losing images would hurt; the listing documents hold their URLs.

## Data export

- **For people:** Profile, "Download your data" (password required) gives a JSON copy of their data.
- **For staff:** the Listings, Agencies, Users and Payments tabs have CSV export. Emails are never included.

## Error alerts

- Server errors and browser errors that reach the error page are grouped and stored in `errorEvents` (kept 60 days). Admin, Errors, shows each with a count and stack. Messages are stripped of emails, phone numbers, tokens and database addresses first.
- Set `ALERT_WEBHOOK_URL` to a Slack, Discord or Teams incoming webhook to get one message the first time a new error appears and at most one an hour while it keeps happening.
- This is not an uptime monitor. Point a free uptime service (UptimeRobot, Better Stack) at `https://hodii.co.ke/` to hear when the whole site is down, because a dead site cannot report itself.

## Staff two-step sign-in

- Each staff member can turn it on in Admin, My account: an authenticator-app code plus 8 one-time backup codes.
- To force it for everyone set `ADMIN_REQUIRE_2FA=1`. Staff without it can then open only My account until they set it up, and it cannot be turned off.
- A full admin can clear an editor's two-step sign-in from Team ("Reset two-step") after a lost phone. If the only admin is locked out, remove the `totp`, `totpPending` and `backupHashes` fields from their document in `adminAccounts`.
- Guessing is limited: 10 wrong tries per address and 10 per account in 15 minutes.

## Sitemaps and search engines

`/sitemap.xml` is an index. It points to `pages.xml`, `locations.xml`, `agencies.xml`, `developments.xml`, `neighbourhoods.xml` and `listings-1.xml`, `listings-2.xml`, and so on (5,000 listings each), all under `/sitemaps/`. Submit `https://hodii.co.ke/sitemap.xml` once in Google Search Console.

## Installable app

`public/site.webmanifest` and `public/sw.js` make Hodii installable on phones. The service worker keeps only built assets and an offline page. It never stores pages or account data. Change `VERSION` in `sw.js` to clear old caches after a big release.

## Help guide, tour and feedback

- Guides live in `src/data/guide.ts` (two audiences). Add an article there; search (`lib/guide-search.ts`) picks it up. Routes: `/help`, `/help/<id>`.
- The tours (`lib/tour.ts`, `components/tour/tour-runner.tsx`) are short and page-specific (home, results, listing, and one per agency dashboard page, chosen by `tourForPath`). Progress is per tour: browser storage plus, when signed in, the `tourProgress` collection. After "don't show again" a small round ? button stays at the bottom left to reopen that page's guide. Choices: "Remind me tomorrow" escalates 1, 1, 3, 7 days then stops; "Don't show again" is final; Help → Start the tour restarts it. Targets are `data-tour="..."` attributes. A cleared browser means the prompt returns.
- Feedback: floating button on every public page and `/feedback`; admin → Feedback inbox. Rate-limited (8/hour per network, hashed) with a honeypot. Account deletion anonymises a person's feedback.
- Verification policy: agencies may list immediately and listings go live; verification only controls the badge. Admin queues flag requests older than `review.verifySlaHours` / `review.reportSlaHours` as overdue.
- Search terms: first-page searches are counted by their words only (no person, no IP), kept 120 days (`searchTerms`), shown in admin → Analytics. Synonyms are in `src/lib/synonyms.ts`.
- Accessibility: axe-core audit (WCAG A/AA, light and dark) was run over the main public pages with no violations after the footer heading fix; a skip link was added. Re-run it after big UI changes.

## Voice search

Switch it on or off and set the limits in Admin, Settings, "Voice search". It needs the same Groq keys as AI search. If those are missing the microphone button simply does not appear. Counts are per person per window and nothing that was said is stored.

## Developments and neighbourhoods

Agencies add developments in their dashboard. Neighbourhood reviews and chat are written by members. Reported items show under Admin, Reviews (below the agency reviews); three different reporters hide an item until staff keep or remove it.
