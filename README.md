# STRAY – Lake Tour Edition website

Upload the whole folder (keep `assets/` next to `index.html`). Host it anywhere static (GitHub Pages works, like the Donut Dash board).

- `index.html` — the site.
- `assets/` — photo, artwork, logos, QR codes, gallery, GPX.
- `Code.gs` — the Google Sheets backend for the 5 km registration form, the pledge form and the leaderboard.
- `README.md` — this file.

## 1. Google Sheet backend

The Sheet "STRAY Lake Tour – Forms (private)" and its Apps Script are already set up and connected. `CONFIG.endpoint` in `index.html` holds the web-app link.

If you change `Code.gs` later: paste it into the Apps Script editor, save, then Deploy → Manage deployments → edit → New version. The link stays the same.

## 2. Run the Pledge Challenge from the Sheet

People pledge as a group or as an individual. There is no pre-set list of groups: people type a group name (friends, a running crew, a club, a team, an association). Individual pledges have entry_type `individual` and show the person's name (contributor_name) on the ranking. STRAY is organised by an independent association; it is not an IMD fundraising event.

Each pledge is one row in **Pledges** with its own ID. Nothing is merged or overwritten.

- **group_name**: what the person typed. The ranking groups pledges by this name, ignoring case, accents and extra spaces ("Lavaux Crew" and "lavaux crew" count together). Different spellings ("Morges RC" vs "Morges Running Club") stay separate: fix the spelling in the row to merge them.
- **status**: `pledged` (default) · `received` · `partly received` · `cancelled` · `duplicate`. Cancelled and duplicate rows drop out of every total.
- **received_chf**: type the amount that actually arrived. The RECEIVED column only counts this.
- A network retry sends the same ID and is stored once. A real second pledge gets a new ID and is kept.
- Groups and individuals can tick "anonymous": column **anonymous** says `yes`, names stay in the Sheet, and the pledge counts on one "Anonymous" line on the ranking. Clear the `yes` to show the name again.
- Each pledger gets an email with payment details from the Google account that deployed the script.
- The ranking refreshes on the site every 60 seconds and after each pledge. The backend caches for 30 seconds.

Registrations for the first 5 km land in **Registrations** with status `requested`. Change to `approved` / `declined` and reply by email yourself.

The old **Classes** tab is no longer used. You can delete it from the Sheet whenever you like.

## 3. What is already filled in

- Logistics: Revolut @gompe and TWINT to +41 76 612 25 56, message "Race logistics".
- Foundation: the TWINT QR. It is an in-app TWINT code, so there is no web link; people scan it.
- Pledges go to the foundation. Past 165 km a group starts a new lap. Target: 8 × 165 = 1,320 km.
- Route: map drawn from the GPX (Ride with GPS 56646783), GPX download.

## 4. Still open (see `index.html#checklist`)

- Runner bios (all except David and Francis); LinkedIn for Angela Gisler and Vincent Leroy
- Foundation paragraph approval
- Official logo files

## 5. Notes

- Why STRAY → "The people who shaped the first STRAY": the people are in `CONFIG.shapers` at the top of the script in `index.html` (name, tag, km, story, link, linkText). Set `km` to a number to fill the KM slot; add a person by copying a block. New text also needs a DE/FR/ES line in `i18n.json`, or it shows in English.
- Languages: EN, DE, FR, ES. The switcher sits top right. A saved choice wins; then `?lang=de` (or fr, es, en) in the link; then the visitor's location from their IP address (get.geojs.io: Swiss French cantons get French, the rest of Switzerland German, Spain and Latin America Spanish); then the browser language; otherwise English. Translations live in `i18n.json` in the build folder and are inlined into `index.html`.

- Landing: the artboard photo upscaled to 4K, small STRAY mark top right, LAKE TOUR EDITION with the lake drawing on the left. Both are cut from the poster's vector file.
- The poster says "29 NOV". The site uses 28–29 Nov because the start is Saturday 28 Nov at 11:00. The date and distance beside the wordmark are live text; the wordmark itself is the poster's vector artwork.
- Links: `#race`, `#why`, `#runners`, `#logistics`, `#donate`, `#pledge`, `#supporters`. Back button and Esc close a panel.
- No card details are ever collected. Payment happens in TWINT or Revolut.
- Logistics money and foundation money are never added together on the site.
