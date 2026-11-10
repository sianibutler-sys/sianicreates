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

## Airtable table: Intake

Base: Siani Creates (appOSPgtix7OtIXGo), table Intake (tblRJ8x6XxWm9SD9t). Status, Submitted, Quote and My notes are for you; the form never writes Quote or My notes.

URL: Assets link

Text fields: Name, Business, Email, Phone, Referral, About the business, Audience, Location, Links, Primary action, What gets booked, Product count, Sells now on, Portfolio count, Inspiration, Three words, Avoid, Deadline, Sign-off, Notes

Single select: Status, Contact preference, Current platform, Domain, Deposits, Text reminders, Made to order, Copy, Photos, Logo, Brand colors and fonts, Updates after launch, Content changes, Budget

Multiple select: Current tools, Needs, Fulfillment, Portfolio format, Pages

Date: Launch date

The function sends `typecast: true`, so select options are created as answers come in.
