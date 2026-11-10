// Cloudflare Pages Function: POST /api/intake
// Saves a Start a project submission to Airtable, then sends two emails through Resend:
// a thank-you to the client with a copy of their answers, and a new-project alert to Siani.
//
// Cloudflare Pages > Settings > Variables and secrets:
//   AIRTABLE_TOKEN  personal access token with data.records:write on the base
//   AIRTABLE_BASE   appOSPgtix7OtIXGo
//   AIRTABLE_TABLE  Intake
//   RESEND_API_KEY  Resend API key (sianicreates.com is verified in Resend)
//   NOTIFY_EMAIL    optional, where new-project alerts go (defaults to hello@sianicreates.com)
// Without RESEND_API_KEY the form still saves; no emails are sent.

const FROM = 'Siani Creates <hello@sianicreates.com>';
const SITE = 'https://sianicreates.com';

// [form key, Airtable field, max length] in the order they appear on the form.
const TEXT = [
  ['name', 'Name', 120], ['business', 'Business', 160], ['email', 'Email', 160], ['phone', 'Phone', 40],
  ['referral', 'Referral', 300], ['about', 'About the business', 2000], ['audience', 'Audience', 500],
  ['location', 'Location', 300], ['links', 'Links', 1000], ['primary_action', 'Primary action', 500],
  ['booking_what', 'What gets booked', 500], ['product_count', 'Product count', 40], ['sell_now', 'Sells now on', 300],
  ['portfolio_count', 'Portfolio count', 40], ['inspiration', 'Inspiration', 2000], ['three_words', 'Three words', 200],
  ['avoid', 'Avoid', 1000], ['deadline', 'Deadline', 300], ['signoff', 'Sign-off', 300], ['notes', 'Notes', 4000]
];
const SINGLE = [
  ['contact_pref', 'Contact preference'], ['current_platform', 'Current platform'], ['domain', 'Domain'],
  ['deposits', 'Deposits'], ['text_reminders', 'Text reminders'], ['made_to_order', 'Made to order'],
  ['copy_ready', 'Copy'], ['photos_ready', 'Photos'], ['logo', 'Logo'], ['brand', 'Brand colors and fonts'],
  ['updates', 'Updates after launch'], ['change_rate', 'Content changes'], ['budget', 'Budget'], ['tier', 'Tier']
];
const MULTI = [
  ['tools', 'Current tools'], ['needs', 'Needs'], ['fulfillment', 'Fulfillment'],
  ['portfolio_format', 'Portfolio format'], ['pages', 'Pages']
];

// Labels for the email copy, in form order.
const LABELS = [
  ['tier', 'Starting point'], ['name', 'Name'], ['business', 'Business'], ['email', 'Email'], ['phone', 'Phone'],
  ['contact_pref', 'Best way to reach you'], ['referral', 'How you heard about Siani Creates'],
  ['about', 'What you do'], ['audience', 'Your clients or customers'], ['location', 'Where you work'], ['links', 'Links'],
  ['current_platform', 'Current website'], ['domain', 'Domain'], ['tools', 'Tools you use now'],
  ['needs', 'What the site needs to do'], ['primary_action', 'The one thing visitors should do'],
  ['booking_what', 'What gets booked'], ['deposits', 'Deposits'], ['text_reminders', 'Text reminders'],
  ['product_count', 'Number of products'], ['sell_now', 'Where you sell now'], ['made_to_order', 'Made to order'],
  ['fulfillment', 'How orders get to customers'], ['portfolio_count', 'Portfolio pieces'], ['portfolio_format', 'Portfolio format'],
  ['pages', 'Pages'], ['copy_ready', 'Website copy'], ['photos_ready', 'Photos'], ['logo', 'Logo'],
  ['brand', 'Brand colors and fonts'], ['assets_link', 'Folder link'], ['inspiration', 'Sites you like'],
  ['three_words', 'Three words for your brand'], ['avoid', "What you don't want"], ['updates', 'Who updates the site'],
  ['change_rate', 'How often content changes'], ['launch_date', 'Ideal launch date'], ['deadline', 'Hard deadline'],
  ['budget', 'Budget'], ['signoff', 'Who else signs off'], ['notes', 'Anything else']
];

export async function onRequestPost({ request, env, waitUntil }) {
  let d;
  try { d = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  if (d.company_site) return json({ ok: true }); // honeypot

  const email = str(d.email);
  if (!str(d.name) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Name and a valid email are required' }, 400);
  }
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE || !env.AIRTABLE_TABLE) {
    return json({ error: 'Form not configured' }, 503);
  }

  // Clean every answer once; emails and Airtable both read from this.
  const clean = {};
  for (const [k, , n] of TEXT) clean[k] = str(d[k]).slice(0, n);
  for (const [k] of SINGLE) clean[k] = str(d[k]).slice(0, 80);
  for (const [k] of MULTI) clean[k] = Array.isArray(d[k]) ? d[k].map((x) => str(x).slice(0, 80)).filter(Boolean).slice(0, 20) : [];
  clean.assets_link = /^https?:\/\/\S+$/.test(str(d.assets_link)) ? str(d.assets_link).slice(0, 500) : '';
  clean.launch_date = /^\d{4}-\d{2}-\d{2}$/.test(str(d.launch_date)) ? d.launch_date : '';

  const fields = { Status: 'New' };
  for (const [k, f] of TEXT) if (clean[k]) fields[f] = clean[k];
  for (const [k, f] of SINGLE) if (clean[k]) fields[f] = clean[k];
  for (const [k, f] of MULTI) if (clean[k].length) fields[f] = clean[k];
  if (clean.assets_link) fields['Assets link'] = clean.assets_link;
  if (clean.launch_date) fields['Launch date'] = clean.launch_date;

  const res = await fetch(
    `https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(env.AIRTABLE_TABLE)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ fields }], typecast: true })
    }
  );
  if (!res.ok) return json({ error: 'Could not save' }, 502);
  const saved = await res.json().catch(() => ({}));
  const recId = saved.records?.[0]?.id;

  const mail = Promise.all([sendThanks(env, clean), sendAlert(env, clean, recId)]);
  if (waitUntil) waitUntil(mail); else await mail;

  return json({ ok: true });
}

// ---------- emails ----------

function answers(c) {
  return LABELS.map(([k, label]) => {
    let v = Array.isArray(c[k]) ? c[k].join(', ') : c[k];
    if (k === 'launch_date' && v) v = new Date(v + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    return v ? [label, v] : null;
  }).filter(Boolean);
}

async function sendThanks(env, c) {
  const first = firstName(c.name);
  const onTheHouse = c.budget === 'Applying for On the House';
  const paras = [
    `Hi ${first},`,
    'Thank you for sending this over. Your answers came through, and I will read every one.',
    'Next up: your quote, or any questions I have, will land in this inbox within three business days. No calls needed unless you want one.',
    ...(onTheHouse ? ['You applied for On the House. I will let you know either way when I reply.'] : []),
    'A copy of what you sent is below, for your records. To add anything, just reply to this email.'
  ];
  await send(env, {
    to: c.email,
    reply_to: 'hello@sianicreates.com',
    subject: 'Got it. Your project is in.',
    text: paras.join('\n\n') + '\n\nSiani\nSiani Creates · sianicreates.com\n\n---\nYOUR ANSWERS\n\n' +
      answers(c).map(([l, v]) => `${l}: ${v}`).join('\n'),
    html: layout(
      paras.map((p) => `<p style="margin:0 0 16px">${esc(p)}</p>`).join('') +
      '<p style="margin:24px 0 0">Siani</p>',
      table(answers(c), 'Your answers')
    )
  });
}

async function sendAlert(env, c, recId) {
  const link = recId ? `https://airtable.com/${env.AIRTABLE_BASE}/${env.AIRTABLE_TABLE_ID || 'tblRJ8x6XxWm9SD9t'}/${recId}` : '';
  const head = [c.name, c.business, c.budget].filter(Boolean).join(' · ');
  await send(env, {
    to: env.NOTIFY_EMAIL || 'hello@sianicreates.com',
    reply_to: c.email,
    subject: `New project: ${head}`,
    text: `${head}\n\n` + answers(c).map(([l, v]) => `${l}: ${v}`).join('\n') + (link ? `\n\nOpen in Airtable: ${link}` : ''),
    html: layout(
      `<p style="margin:0 0 6px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#2F55FF;font-weight:700">New project</p>` +
      `<p style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0E0E10">${esc(head)}</p>` +
      `<p style="margin:0">Reply to this email to answer ${esc(firstName(c.name))} directly.</p>` +
      (link ? `<p style="margin:20px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#0E0E10;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Open in Airtable</a></p>` : ''),
      table(answers(c), 'Their answers')
    )
  });
}

async function send(env, msg) {
  if (!env.RESEND_API_KEY || !msg.to) return;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [msg.to], reply_to: msg.reply_to, subject: msg.subject, text: msg.text, html: msg.html })
  });
  if (!r.ok) console.log('email failed', r.status, await r.text());
}

function layout(top, bottom) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#F6F5F1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F1"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E3E1DA;border-radius:14px;overflow:hidden">
<tr><td style="background:#0E0E10;padding:22px 32px"><img src="${SITE}/assets/img/siani-creates.png" width="72" alt="Siani Creates" style="display:block;border:0;height:auto"></td></tr>
<tr><td style="padding:32px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#3A3A40">${top}</td></tr>
<tr><td style="padding:0 32px 32px;font-family:Helvetica,Arial,sans-serif">${bottom}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #E3E1DA;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6B6B73">Siani Creates · <a href="${SITE}" style="color:#2F55FF;text-decoration:none">sianicreates.com</a></td></tr>
</table></td></tr></table></body></html>`;
}

function table(rows, title) {
  return `<p style="margin:0 0 10px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#2F55FF;font-weight:700">${esc(title)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E3E1DA">${rows.map(([l, v]) =>
  `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid #E3E1DA;font-size:13px;color:#6B6B73;vertical-align:top;width:38%">${esc(l)}</td><td style="padding:10px 0;border-bottom:1px solid #E3E1DA;font-size:14px;color:#0E0E10;vertical-align:top;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table>`;
}

function firstName(full) {
  const parts = String(full || '').trim().split(/\s+/);
  if (parts.length > 1 && /^(dr|mr|mrs|ms|rev|prof)\.?$/i.test(parts[0])) return parts[1];
  return parts[0] || 'there';
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
