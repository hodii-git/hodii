# Hodii roadmap

## Done
- [x] Part 1: rebrand, public information and legal pages.
- [x] Part 2: property data model, agencies, users, roles and permissions.
- [x] Part 3: search, listing pages, agency dashboards, photo upload, enquiries, moderation.
- [x] Part 4: admin analytics and management, account page, one site header, all news code and legacy collections removed.

## Next
- [x] Scraper for listings (backend): a "Hodii Imports" agency per source; listings enter as `pending_review`; dedupe on `source.kind` + `source.externalId`.
- [x] Saved-search alerts, invitation emails, billing for featured placement.
- [x] Advocate review of the legal pages before launch.
- [x] Homepage: whiter header/search/trust strip, map ends at search bar, List/Map pill bottom-centre, typed price, glass dropdowns.
- [x] Homepage search bar with More filters, Ask AI, in-page results.
- [x] Remaining keys (Cloudinary, Groq, admin, encryption key) — user chose MongoDB only for now.

## UI polish (Nov 20)
- [x] Hamburger: 3 lines, longest top → shortest bottom, right-aligned
- [x] Glassy blurred dropdowns everywhere (filters, map/list pill) like listing cards
- [x] Search input: single line by default; expands full width when typing, filters + Ask AI drop below; glassier input; darker Ask AI
- [x] Map/location selection auto-fills filters and shows active choices
- [x] Restyle "change location" pill + its panel

## UI polish 2 (Nov 20)
- [x] Filters count badge top-right superscript, darker filters text/icon
- [x] Card image chevrons glassy, show on image hover
- [x] Grid: max card width, one fewer column
- [x] Header overflow: List a property / Sign in buttons
- [x] Map below listings when not side-by-side; map pills centred horizontally, zoom bottom-right
- [x] Small screens: More filters + Ask AI pills side by side
- [x] Header hover bg grey glassy, not brown
- [x] Bell + theme toggle circle bg same size as avatar
- [x] Profile dropdown + hamburger: responsive size, bigger icons in rounded square tiles
- [x] Skeleton cards instead of "Searching" text
- [x] Only one filter dropdown open at a time

## Search and interface corrections (Nov 20)
- [ ] Make the filter count smaller and move it slightly higher.
- [ ] Contain and right-align Ask AI; tighten homepage spacing and desktop type; mark List active.
- [ ] Unify glass reminders, tour and feedback; silver header hovers and avatar-sized circles; dropdown icons.
- [ ] Separate map tools, zoom and overlays; show pin cards above all map controls; clean loaders.
- [ ] Remove lingering pointer focus outlines; increase wide-screen grid columns; toggle selected optional filters off.

## UI polish 3 (Nov 20)
- [x] Headings use the basic sans font everywhere (serif removed)
- [x] Loading cards: grey shapes only, no white card
- [x] No border on photo chevrons
- [x] Grid steps 2/3/4 then 5 only on very wide screens
- [x] Header icons same size, softer resting background, hamburger shrinks on hover/open
- [x] Feedback button a perfect circle when compact; ? button bottom-left on all screens

## Mobile listing page redesign (Nov 25)
- [ ] Redesign `/property/$slug` on small screens (`< 768px`) to match the dark reference layout
- [ ] Top bar: 2-slider filter icon (kept for later), 3 pills matching the listing (for sale/rent, property type, area), purple menu icon opening site menu
- [ ] Hero photo with compare, save, share inside image, `1 / N` pill top-right, fullscreen button bottom-right
- [ ] Info block (title, description excerpt, green price + location, bed/bath/size row) + 5 circular colored action icons + 5-icon dark bottom bar
- [ ] Keep all existing cards, buttons, texts, enquiry form, comments, and related listings stacked below in the dark theme, with 4 quick-jump card shortcuts
- [x] Filter dropdown text wraps instead of overflowing
- [x] Glassy blurred backdrop behind popups; page inactive while dropdowns are open
- [x] Saving/Sending/Uploading buttons show the loader

## UI polish 4 (Nov 20)
- [x] Browse dropdown: hover life + feedback-popup look
- [x] Feedback popup bottom padding; small-screen side gap
- [x] Guide cards/popups share feedback-popup style
- [x] Homepage filters as feedback-style popup
- [x] Search textarea max height then scroll
- [x] Theme, bell, menu circles exactly avatar size
- [x] Layout toggle pill (1 col / 2 col / horizontal) next to "Near" pill; horizontal multi-col on bigger screens

## UI polish 5 (Nov 20)
- [x] Grid: 6 across only from 2200px wide; horizontal layout photo left, text right
- [x] Guide popups: pause button hover effect; click outside closes any popup
- [x] Browse dropdown items: visible hover
- [x] Theme toggle: remove from header; signed-in → black full-width strip at bottom of profile dropdown holding the toggle; signed-out stays in menu
- [x] All popups (browse, guide, tour, filters) clone feedback popup style: colored icons, orange top message, buttons, card bg, border
- [x] Feedback popup bottom padding; small-screen side gap on all popups
- [x] Search textarea max height then scroll
- [x] Theme/bell/menu circles exactly avatar size
- [x] Layout pill: small screens 1 col / 2 col / horizontal; larger screens current ↔ horizontal (multi-column)

## UI polish 6 (Nov 20)
- [x] Guide prompt card: X close top right
- [x] Header menu, profile dropdown, filters popup: every item in its own feedback-style card (bigger, spaced, border, hint text)
- [x] Theme switch: light feedback-style card at the bottom of the menu, not a black strip
- [x] Loading placeholder cards follow the chosen card layout (grid / one card / horizontal)
- [x] Grid columns: 2 → 3 → 4, 5 from 1300px, then 6, 7, 8… growing automatically with width
- [x] Popup close (X) buttons: round background circle with hover effect

## UI polish 7 (Nov 20)
- [x] Header dropdowns + filters: no red, green or purple icons — only black, grey, orange (blue kept)
- [x] Grid: five across starts at 1400px
