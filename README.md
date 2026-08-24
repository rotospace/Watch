# Local Prospect Outreach

A small, self-contained web app for running cold-email outreach to local business
owners — "reach **[industry]** owners in **[city/region]**" — starting with South
Florida, but built so any city or region can be added.

No build step, no server, no account. Everything runs in the browser and is saved
to that browser's local storage.

## Running it

Open `index.html` directly in a browser, or serve the folder locally:

```bash
npx http-server -p 8080 .
# then open http://localhost:8080
```

To publish it somewhere you can access from any device, push this folder to
GitHub Pages (Settings → Pages → deploy from this branch), Netlify, or any static
host — it's just three static files (`index.html`, `styles.css`, `app.js`, `data.js`).

**Note:** data lives in that browser's local storage only. Use Setup → **Export full
backup** to move your scripts/prospects to another browser or device, then
**Import backup** there.

## How it's organized

1. **Setup** — your name/company/contact info, your one-line offer/value
   proposition, a proof point, and your booking link. These fill the
   `{{your_offer}}`, `{{proof_point}}`, `{{signature}}`, etc. merge fields used in
   every script. Also where you add markets (city + region) — South Florida cities
   are pre-loaded, add any other city/region here. **Region** is any grouping
   broader than one city — it doesn't have to be "South Florida"; use it for
   sub-areas like Upper Keys / Middle Keys / Lower Keys, a county, a metro name,
   whatever you actually want to filter and send by later. Click a market chip to
   edit its city or region in place; typing a region reuses one you've already
   entered via autocomplete, so naming stays consistent as you add more markets.
2. **Scripts** — 18 industries pre-loaded across Home Services, Professional
   Services, Health & Wellness, and Food & Retail, each with a 3-email sequence
   (initial outreach → follow-up → breakup/last touch). Edit any script per
   industry, or add your own industries (they get a sensible default sequence
   immediately, generated from the same framework).
3. **Prospects** — add business owners one at a time, or bulk import a CSV with
   columns `business_name, owner_first_name, email, phone, website, city, region, industry`.
   Unrecognized cities/industries in the CSV are created automatically — a new
   city defaults to the South Florida region if the `region` column is left
   blank, so fill it in when a city needs its own grouping. Filter the prospect
   list by region, market, or industry (any combination). Click **Edit** on any
   row to fix a field in place (e.g. filling in a blank you
   didn't have at import time).
4. **Generate & Send** — filter prospects by region/market/industry, pick a
   sequence step, and generate the merged emails. Copy any email individually, mark
   prospects as sent per step (so step 2/3 filters only show who's actually due),
   or export the batch as a CSV for a mail-merge tool.

## Merge fields available in every script

`{{business_name}}` `{{owner_first_name}}` `{{website}}` `{{city}}` `{{region}}`
`{{industry_label}}` `{{pain_hook}}` `{{your_name}}` `{{your_company}}`
`{{your_offer}}` `{{proof_point}}` `{{booking_link}}` `{{your_phone}}` `{{signature}}`

## Extending it

- **New industry:** Scripts tab → add name, category, and the one-line pain point
  used in the opening line. It's ready to use immediately.
- **New city/region:** Setup tab → add region + city. Also created automatically
  the first time it appears in a CSV import.
- **New script variant:** edit any step's subject/body directly in the Scripts
  tab — changes save automatically and only affect that industry.
