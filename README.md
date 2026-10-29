# STRAY – Lake Tour Edition website

Upload the whole folder (keep `assets/` next to `index.html`). Host it anywhere static (GitHub Pages works, like the Donut Dash board).

- `index.html` — the site.
- `assets/` — photo, artwork, logos, QR codes, gallery, GPX.
- `Code.gs` — the Google Sheets backend for the 5 km registration form, the pledge form and the leaderboard.
- `README.md` — this file.

## 1. Connect the Google Sheet (15 min)

1. Create a new Google Sheet in the organiser account. Keep it private.
2. Extensions → Apps Script. Delete the sample code, paste `Code.gs`, save.
3. Run `setup` once (select it in the toolbar, press Run, accept the permissions). It creates three tabs: **Registrations**, **Pledges**, **Classes**.
4. Fill the **Classes** tab. This is the controlled list people pick from. One row per class or group:
   `class_id` (short, never changes, e.g. `mba-2026`) · `display_name` (what the board shows) · `active` (tick).
5. Deploy → New deployment → type **Web app** · Execute as **Me** · Who has access **Anyone** → Deploy. Copy the URL ending in `/exec`.
6. In `index.html`, find `const CONFIG` near the bottom and paste the URL into `endpoint`.

Until `endpoint` is set, both forms show "This form opens soon" and are disabled, and the leaderboard says it is not live. Nothing fake shows.

If you change `Code.gs` later: Deploy → Manage deployments → edit → New version. The URL stays the same.

## 2. Run the pledge challenge from the Sheet

Each pledge is one row with its own ID. Nothing is merged or overwritten.

- **status**: `pledged` (default) · `received` · `partly received` · `cancelled` · `duplicate`. Cancelled and duplicate rows drop out of every total.
- **received_chf**: type the amount that actually arrived. The board's RECEIVED column only counts this.
- Fix a typo in a name or amount directly in the row.
- Classes total by `class_id`. Individuals total by a salted hash of their email, so the same person pledging twice adds up, and the email never leaves the Sheet.
- An individual shows on the board by display name only if they ticked consent. Otherwise "Anonymous".
- A network retry sends the same ID and is stored once. A real second pledge gets a new ID and is kept.
- Board refreshes on the site every 60 seconds and after each pledge. The backend caches for 30 seconds.

Registrations land in **Registrations** with status `requested`. Change to `approved` / `decline## 3. What is already filled in

- Logistics: Revolut @gompe (QR checked: opens revolut.me/gompe) and TWINT to +41 76 612 25 56, message "Race logistics".
- Foundation: the TWINT QR you sent. It is an in-app TWINT code, so there is no web link; people scan it.
- Pledges go to the foundation. Past 165 km a class starts a new lap. Board target: 8 × 165 = 1,320 km.
- Route: map drawn from the GPX (Ride with GPS 56646783), GPX download.
- LinkedIn for 6 runners, 4 organisers, 5 support crew. Felix Yoon, Shivani Kalmane, Esha Rawat are in CONFIG with `confirmed: false` and stay hidden until you flip them.
- Association footer lines are on.

## 4. Still open (see `index.html#checklist`)

- Sheet connection (`endpoint`) and the Classes list
- Runner photos and short bios (all 8); LinkedIn for Angie Gisler and Vincent Leroy
- Foundation paragraph approval; origin story (optional)
- Official logo files. Current ones are AI-upscaled from the flyer: big marks are clean, the SEMS small text is still soft.
- Permit wording on launch day

To add a runner photo: drop it in `assets/` and set `photo: "assets/name.jpg"` in CONFIG.
To add gallery photos: grade them like the others (muted colour, purple shadows, grain) and add a line to `SHOTS` in the script.

ach partner. REVIVR is not listed (product support only, not a partner).

## 5. Notes

- Landing: the artboard photo upscaled to 4K, small STRAY mark top right, LAKE TOUR EDITION with the lake drawing on the left. Both are cut from the poster's vector file.
- The poster says "29 NOV". The site uses 28–29 Nov because the start is Saturday 28 Nov at 11:00. The date and distance beside the wordmark are live text; the wordmark itself is the poster's vector artwork.
- Links: `#race`, `#why`, `#runners`, `#logistics`, `#donate`, `#pledge`, `#supporters`. Back button and Esc close a panel.
- No card details are ever collected. Payment happens in TWINT or Revolut.
- Logistics money and foundation money are never added together on the site.
