# Search, ranking and AI search

## Typed search (free, always on)
- Every word must appear somewhere in the listing: title, description, highlights, extra features, area, county, sub-county, address, landmark, nearby place names, reference, plus the catalogue feature names ("pool" finds the swimming-pool tick). Plural/singular are treated alike. The search is a regex scan, which is fine for tens of thousands of listings; move to Atlas Search if it grows far beyond that.
- A pasted reference code (HD-7K3M2Q) finds that exact listing.
- `lib/query-intent.ts` reads sentences such as "2 bedroom apartment kilimani under 80k to rent": bedrooms, bathrooms, rent/sale/short stay, property type, county, price ("under 80k", "between 20k and 40k", "5m"), furnishing, verified and named features become filters. Whatever is left ("kilimani") stays as the keyword. The filters open so the person can change them. A single word is treated as a plain keyword.

## Ranking (`lib/rank.ts`)
`score = text match (0–100) + freshness (up to 10 inside `rank.freshDays`) + tier lift + 3 if verified`. Boosted listings get `rank.boostLift`, Premium `rank.premiumLift`. A listing that does not match the words never appears, however much was paid. `mixPaid` then keeps paid listings to at most `rank.maxPaidSharePct`% of each page. The newest 240 matches are ranked; deeper pages and the explicit sort options (Newest, price, size) are plain database sorts. "Best match" is the default.

## AI search
- Server: `lib/ai-search.server.ts`. The model only returns filters, which `lib/ai-criteria.ts` validates one by one against our own lists; nothing the model writes reaches the database unchecked.
- Keys: `GROQ_API_KEYS` (comma separated) or `GROQ_API_KEY`. A key that is out of credit (HTTP 402, or 429 about quota) rests for an hour, a rejected key (401/403) for 6 hours, a busy key for seconds; the next key is used straight away. If none work, the built-in understanding answers and the person is not charged.
- Allowance: counted per account (or per network for visitors) in `aiUsage`, a count only, never the text. Limits and window: admin Settings > AI search. Visitors, normal accounts, agency members and Premium agency members have separate limits. A use is only kept when the AI really answered.
- When the allowance is spent a popup shows a countdown; the profile page shows the same ticking timer.
