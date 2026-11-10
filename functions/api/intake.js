// Cloudflare Pages Function: POST /api/intake
// Saves a Start a project submission to Airtable.
// Set these in Cloudflare Pages > Settings > Variables and secrets:
//   AIRTABLE_TOKEN  personal access token with data.records:write on the base
//   AIRTABLE_BASE   base ID, starts with "app"
//   AIRTABLE_TABLE  table name or ID, e.g. "Intake"
// Field names below must match the Airtable table. typecast lets Airtable
// create new select options on the fly.

const TEXT = {
  name: ['Name', 120], business: ['Business', 160], email: ['Email', 160], phone: ['Phone', 40],
  referral: ['Referral', 300], about: ['About the business', 2000], audience: ['Audience', 500],
  location: ['Location', 300], links: ['Links', 1000], primary_action: ['Primary action', 500],
  booking_what: ['What gets booked', 500], product_count: ['Product count', 40], sell_now: ['Sells now on', 300],
  portfolio_count: ['Portfolio count', 40], inspiration: ['Inspiration', 2000], three_words: ['Three words', 200],
  avoid: ['Avoid', 1000], deadline: ['Deadline', 300], signoff: ['Sign-off', 300], notes: ['Notes', 4000]
};
const SINGLE = {
  contact_pref: 'Contact preference', current_platform: 'Current platform', domain: 'Domain',
  deposits: 'Deposits', text_reminders: 'Text reminders', made_to_order: 'Made to order',
  copy_ready: 'Copy', photos_ready: 'Photos', logo: 'Logo', brand: 'Brand colors and fonts',
  updates: 'Updates after launch', change_rate: 'Content changes', budget: 'Budget'
};
const MULTI = {
  tools: 'Current tools', needs: 'Needs', fulfillment: 'Fulfillment',
  portfolio_format: 'Portfolio format', pages: 'Pages'
};

export async function onRequestPost({ request, env }) {
  let d;
  try { d = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  if (d.company_site) return json({ ok: true }); // honeypot

  if (!str(d.name) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(d.email))) {
    return json({ error: 'Name and a valid email are required' }, 400);
  }
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE || !env.AIRTABLE_TABLE) {
    return json({ error: 'Form not configured' }, 503);
  }

  const fields = { Status: 'New' };
  for (const [k, [f, n]] of Object.entries(TEXT)) { const v = str(d[k]).slice(0, n); if (v) fields[f] = v; }
  for (const [k, f] of Object.entries(SINGLE)) { const v = str(d[k]).slice(0, 80); if (v) fields[f] = v; }
  for (const [k, f] of Object.entries(MULTI)) {
    if (Array.isArray(d[k]) && d[k].length) fields[f] = d[k].map((x) => str(x).slice(0, 80)).filter(Boolean).slice(0, 20);
  }
  if (/^https?:\/\/\S+$/.test(str(d.assets_link))) fields['Assets link'] = str(d.assets_link).slice(0, 500);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str(d.launch_date))) fields['Launch date'] = d.launch_date;

  const res = await fetch(
    `https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(env.AIRTABLE_TABLE)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ fields }], typecast: true })
    }
  );
  if (!res.ok) return json({ error: 'Could not save' }, 502);
  return json({ ok: true });
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
