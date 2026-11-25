# Boosts, Premium packages and M-Pesa

Publishing is always free and never waits on payment. Every listing is **Basic** (no badge) until someone pays:

- **Boosted** (per listing): the agency picks any number of days, from 1 up to the longest boost in Settings (365 by default, 7 pre-selected). The price is worked out live and re-checked on the server.
- **Premium** (per agency): a package of listing slots for a fixed term (30 days, 10 slots by default). Listings are added to a package and removed at once; buying while one is running creates a second package. When a package ends, a Renew button re-buys it with the same listings.

Rates, discounts, slots, term, AI quotas and ranking weights are all edited in **Admin, Settings**. Nothing is hard-coded except the shape of the rules.

## How the boost price is worked out (`src/lib/pricing.ts`)

`daily rate × value band`, then a discount for longer boosts (from 14, 30 and 90 days), rounded to KES 10, with a minimum.

| County demand | Counties | Daily rate |
|---|---|---|
| High | Nairobi, Mombasa, Kiambu | KES 60 |
| Mid | Kajiado, Machakos, Nakuru, Kisumu, Uasin Gishu, Laikipia | KES 40 |
| Base | everything else | KES 25 |

Value band: ×0.8 for cheap listings, ×1 normal, ×1.25 high, ×1.5 luxury (sale: under 3M / 15M+ / 50M+; rent: under 15k / 60k+ / 150k+). The rates above and the discounts (10% from 14 days, 25% from 30, 40% from 90) are the defaults; change them in Admin, Settings.

## Turning on M-Pesa (Safaricom Daraja)

Payments are off until all of these are set. Without them the page says online payment is not switched on and the agency can skip.

| Variable | Meaning |
|---|---|
| `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET` | From the Daraja portal app |
| `DARAJA_SHORTCODE`, `DARAJA_PASSKEY` | Paybill or till shortcode and its Lipa na M-Pesa passkey |
| `DARAJA_PARTY_B` | Optional. The till number when using Buy Goods |
| `DARAJA_TRANSACTION_TYPE` | Optional. `CustomerPayBillOnline` (default) or `CustomerBuyGoodsOnline` |
| `DARAJA_ENV` | `production` for live. Anything else uses the sandbox |
| `DARAJA_CALLBACK_SECRET` | A long random string. It is part of the callback address |
| `PUBLIC_SITE_URL` | e.g. `https://hodii.co.ke` |

Register `https://<site>/api/mpesa/callback/<DARAJA_CALLBACK_SECRET>` as the callback. The callback checks the secret, the CheckoutRequestID and that the amount paid is not below the price. The payment page also asks Safaricom directly if the callback is slow, and gives up after 5 minutes. Each payment can only be settled once.

**Not tested against Safaricom.** Try it in the sandbox before going live.

## Admin

Admin → **Payments** lists payments and totals, and records a boost (by listing reference) or a Premium package (by agency address name) taken outside the site (cash, bank, a missed callback), and applies it straight away. Staff can also give a listing a free 30-day boost from the Listings tab; those have no payment attached.

## Contact-number reveal cap

A visitor can reveal 10 different listings' numbers per day (40 when signed in), and one network 120 by default; all three are in Admin, Settings. Re-opening one already revealed is free.

## Expiry notices

Agencies get an in-site notice when a boost or package is about to end (3 days by default) and when it has ended, once each. They are sent when an agency opens its dashboard, and for everyone else by a scheduler that calls `GET /api/cron/promotions` with the header `Authorization: Bearer <CRON_SECRET>` once an hour (cron-job.org, GitHub Actions or the host's cron). Set `CRON_SECRET` to a long random string.

## Basic listing limit, freezing and extra space
- Every agency may keep **`basic.maxLive`** free (Basic) listings live, and **`basic.maxStored`** in total (drafts, paused, frozen and live Basic listings; this is what bounds photo storage). Boosted and Premium listings are never counted and never capped.
- **Extra space** packs (`space.priceKes` for `space.slots` listings for `space.days` days, bought on the Listing space page or recorded by an admin) add to both numbers while running.
- **Publishing at the limit** (new, resumed, renewed or unfrozen) is refused for a free listing and the screen offers: boost this listing, buy Premium, add space, or make room (freeze or delete). A boost or Premium chosen for a draft, frozen or expired listing puts it live the moment it is paid for, with no free place used.
- **When a boost or package ends** the listing stays live as Basic if there is room. If the agency is over its allowance, after `basic.graceDays` the listings that just lost paid status are **frozen** (hidden, kept, owner notified), most recently ended first; only if still over, the least-viewed Basic listings are frozen. Frozen listings can be boosted, added to Premium, brought back when there is room, or deleted. Ending extra space is handled the same way.
- Freezing runs when an agency opens its Listing space or listings page and from `GET /api/cron/promotions`. Owners can also freeze a listing themselves to free its place.
- A listing lives 90 days (renewable). A boost or package never outlives its listing: paying extends the listing's own expiry to at least the paid end date.

## Revenue reporting and refunds

- Admin → Payments shows net, gross, refunded and average sale for 7/30/90/365 days, a daily chart (Nairobi days), sales by kind and top agencies (`src/lib/revenue.ts`, `revenue.server.ts`).
- "Waiting over 30 minutes" lists pending M-Pesa payments with no result. Check the M-Pesa statement; if money arrived, record it with the manual forms.
- **Refund** marks a paid payment `refunded` with a required note, and ends what was bought: the boost (only if that payment was the latest one extending it), the Premium package (its listings go back to Basic) or the extra space pack. The agency is then brought back inside its Basic limit. The money itself is returned by an M-Pesa reversal outside the site.
- Export CSV (Payments) now includes kind, agency, paid date, refund date and note.
- Agencies with billing access see Payments (dashboard tab): paid and refunded payments with M-Pesa receipt codes, printable.
- Not built: automatic M-Pesa reversal.

## Pricing page

`/info/pricing` reads the live values from admin Settings, so it never disagrees with what is charged. Footer link: Company → Pricing.
