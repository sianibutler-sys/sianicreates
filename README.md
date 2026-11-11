# Siani Creates

Site for Siani Creates. Static HTML/CSS/JS on Cloudflare Pages, with one Pages Function for the intake form.

## Files

- `index.html` – the whole site, one page
- `styles.css`, `script.js`
- `assets/img/` – logo and portfolio screenshots
- `functions/api/intake.js` – Start a project form, writes to Airtable

## Deploy on Cloudflare Pages

1. Pages > Create > Connect to Git > `sianicreates`, branch `main`
2. Framework preset: None. Build command: blank. Output directory: `/`
3. Settings > Variables and secrets (Production):
   - `AIRTABLE_TOKEN` – personal access token, scope `data.records:write`, access to the Siani Creates base
   - `AIRTABLE_BASE` – base ID (`app…`)
   - `AIRTABLE_TABLE` – `Intake`
   - `RESEND_API_KEY` – from Resend (sianicreates.com is verified). Sends the client a thank-you with a copy of their answers, and sends you a new-project alert.
   - `NOTIFY_EMAIL` – optional, where alerts go. Defaults to hello@sianicreates.com

## Airtable table: Intake

Base: Siani Creates (appOSPgtix7OtIXGo), table Intake (tblRJ8x6XxWm9SD9t). Status, Submitted, Quote and My notes are for you; the form never writes Quote or My notes.

URL: Assets link

Other/follow-up text fields: Current platform other, Domain name, Domain registrar, Current tools other, Needs other, Pages other

Launch fields: Launch timing (required), and when it's "By a specific date": Launch date, Date firm, Launch reason (all required). The old Deadline field is no longer written.

Tier (single select): The Page, The Site, The System, Not sure yet

The form and the function enforce the same rules: required answers, follow-ups that only count when the answer that asked for them is present, chip answers limited to the listed options, and hidden follow-ups cleared before sending.

Text fields: Name, Business, Email, Phone, Referral, About the business, Audience, Location, Links, Primary action, What gets booked, Product count, Sells now on, Portfolio count, Inspiration, Three words, Avoid, Deadline, Sign-off, Notes

Single select: Status, Contact preference, Current platform, Domain, Deposits, Text reminders, Made to order, Copy, Photos, Logo, Brand colors and fonts, Updates after launch, Content changes, Budget

Multiple select: Current tools, Needs, Fulfillment, Portfolio format, Pages

Date: Launch date

The function sends `typecast: true`, so select options are created as answers come in.

## Work section

All projects live in `work/projects.json`. The home page shows the ones marked `"featured": true` (one per site type), and `/work/` shows all of them with filters by site type.

To add or change a project: edit `work/projects.json`, add its desktop screenshot to `assets/img/` and a 360x360 phone thumbnail to `assets/img/work/`, then run `python3 scripts/build_work.py`. The script rewrites the cards in `index.html` and `work/index.html` and updates the counts. Each project also needs its own case study page at `work/<slug>/index.html`.
