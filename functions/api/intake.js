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
  ['location', 'Location', 300], ['links', 'Links', 1000],
  ['current_platform_other', 'Current platform other', 80], ['domain_name', 'Domain name', 120],
  ['domain_registrar', 'Domain registrar', 80], ['tools_other', 'Current tools other', 200],
  ['needs_other', 'Needs other', 300], ['primary_action', 'Primary action', 500],
  ['booking_what', 'What gets booked', 500], ['product_count', 'Product count', 5], ['sell_now', 'Sells now on', 300],
  ['portfolio_count', 'Portfolio count', 4], ['pages_other', 'Pages other', 200], ['inspiration', 'Inspiration', 2000],
  ['three_words', 'Three words', 200], ['avoid', 'Avoid', 1000], ['launch_reason', 'Launch reason', 300],
  ['signoff', 'Sign-off', 300], ['notes', 'Notes', 4000]
];

// Every chip question and the only answers it accepts. Anything else is dropped.
const CHOICES = {
  contact_pref: ['Contact preference', ['Text', 'Email', 'Call']],
  current_platform: ['Current platform', ['No', 'Wix', 'Squarespace', 'Shopify', 'WordPress', 'GoDaddy', 'Other']],
  domain: ['Domain', ["Yes, and I know where it's registered", 'Yes, not sure where', 'No']],
  deposits: ['Deposits', ['Yes', 'No', 'Not yet']],
  text_reminders: ['Text reminders', ['Yes', 'No', 'Not sure']],
  made_to_order: ['Made to order', ['Yes', 'No', 'Some']],
  copy_ready: ['Copy', ['Ready', 'Some of it', 'I need it written']],
  photos_ready: ['Photos', ['Professional and ready', 'Phone photos', 'I need help']],
  logo: ['Logo', ['Yes, with files', 'Yes, low quality', 'No']],
  brand: ['Brand colors and fonts', ['Set', 'A loose idea', 'None yet']],
  tier: ['Tier', ['The Hello', 'The Front Desk', 'The System', 'Not sure yet']],
  budget: ['Budget', ['Under $800', '$800–$1,800', '$1,800–$3,500', '$3,500+', "Not sure, I'd like guidance", 'Applying for On the House']],
  updates: ['Updates after launch', ['Me. Teach me how.', "I'd like you to handle it", 'Not sure']],
  change_rate: ['Content changes', ['Rarely', 'Monthly', 'Weekly']],
  launch_timing: ['Launch timing', ['By a specific date', 'As soon as possible', 'In the next 1–2 months', 'No rush']],
  date_firm: ['Date firm', ['Firm', 'Flexible']]
};
const MULTI_CHOICES = {
  tools: ['Current tools', ['GlossGenius', 'Calendly', 'Square', 'Stripe', 'PayPal', 'Cash App or Zelle', 'Other', 'None yet']],
  needs: ['Needs', ['Show my work', 'Take bookings', 'Take inquiries or quote requests', 'Sell products', 'Sell services or packages with deposits', 'Show Instagram content', 'Collect testimonials', 'Build an email list', 'Promote events', 'Something else']],
  fulfillment: ['Fulfillment', ['Shipping', 'Local pickup', 'Digital download']],
  portfolio_format: ['Portfolio format', ['Photos', 'Video', 'Audio', 'Writing']],
  pages: ['Pages', ['Home', 'About', 'Services', 'Portfolio', 'Book', 'Shop', 'Contact', 'FAQ', 'Testimonials', 'Blog', 'Other', 'Not sure yet']]
};

// Labels for the email copy, in form order.
const LABELS = [
  ['tier', 'Starting point'], ['name', 'Name'], ['business', 'Business'], ['email', 'Email'], ['phone', 'Phone'],
  ['contact_pref', 'Best way to reach you'], ['referral', 'How you heard about Siani Creates'],
  ['about', 'What you do'], ['audience', 'Your clients or customers'], ['location', 'Where you work'], ['links', 'Links'],
  ['current_platform', 'Current website'], ['current_platform_other', 'Platform'], ['domain', 'Domain'], ['domain_name', 'Domain name'], ['domain_registrar', 'Registered with'], ['tools', 'Tools you use now'], ['tools_other', 'Other tools'],
  ['needs', 'What the site needs to do'], ['needs_other', 'Something else'], ['primary_action', 'The one thing visitors should do'],
  ['booking_what', 'What gets booked'], ['deposits', 'Deposits'], ['text_reminders', 'Text reminders'],
  ['product_count', 'Number of products'], ['sell_now', 'Where you sell now'], ['made_to_order', 'Made to order'],
  ['fulfillment', 'How orders get to customers'], ['portfolio_count', 'Portfolio pieces'], ['portfolio_format', 'Portfolio format'],
  ['pages', 'Pages'], ['pages_other', 'Other pages'], ['copy_ready', 'Website copy'], ['photos_ready', 'Photos'], ['logo', 'Logo'],
  ['brand', 'Brand colors and fonts'], ['assets_link', 'Folder link'], ['inspiration', 'Sites you like'],
  ['three_words', 'Three words for your brand'], ['avoid', "What you don't want"], ['updates', 'Who updates the site'],
  ['change_rate', 'How often content changes'], ['launch_timing', 'When you need it live'], ['launch_date', 'Launch date'], ['date_firm', 'Date is'], ['launch_reason', 'Date tied to'],
  ['budget', 'Budget'], ['signoff', 'Who else signs off'], ['notes', 'Anything else']
];

export async function onRequestPost({ request, env, waitUntil }) {
  let d;
  try { d = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  if (d.company_site) return json({ ok: true }); // honeypot


  // Clean every answer once; emails and Airtable both read from this.
  const clean = {};
  for (const [k, , n] of TEXT) clean[k] = str(d[k]).slice(0, n);
  for (const [k, [, ok]] of Object.entries(CHOICES)) clean[k] = ok.includes(str(d[k])) ? str(d[k]) : '';
  for (const [k, [, ok]] of Object.entries(MULTI_CHOICES)) {
    clean[k] = Array.isArray(d[k]) ? [...new Set(d[k].map(str))].filter((x) => ok.includes(x)) : [];
  }
  clean.assets_link = /^https?:\/\/[^\s.]+\.\S+$/.test(str(d.assets_link)) ? str(d.assets_link).slice(0, 500) : '';
  clean.launch_date = /^\d{4}-\d{2}-\d{2}$/.test(str(d.launch_date)) ? d.launch_date : '';
  if (!clean.tier) clean.tier = 'Not sure yet';

  // Follow-ups only count when the answer that asked for them is present.
  const has = (k, v) => clean[k].includes(v);
  if (clean.current_platform !== 'Other') clean.current_platform_other = '';
  if (!clean.domain.startsWith('Yes')) clean.domain_name = '';
  if (clean.domain !== "Yes, and I know where it's registered") clean.domain_registrar = '';
  if (!has('tools', 'Other')) clean.tools_other = '';
  if (!has('needs', 'Something else')) clean.needs_other = '';
  if (!has('pages', 'Other')) clean.pages_other = '';
  const booking = has('needs', 'Take bookings') || has('needs', 'Sell services or packages with deposits');
  const store = has('needs', 'Sell products');
  if (!booking) { clean.booking_what = ''; clean.deposits = ''; clean.text_reminders = ''; }
  if (!store) { clean.product_count = ''; clean.sell_now = ''; clean.made_to_order = ''; clean.fulfillment = []; }
  if (!has('needs', 'Show my work')) { clean.portfolio_count = ''; clean.portfolio_format = []; }
  const dated = clean.launch_timing === 'By a specific date';
  if (!dated) { clean.launch_date = ''; clean.date_firm = ''; clean.launch_reason = ''; }
  const today = new Date().toISOString().slice(0, 10);
  if (clean.launch_date && clean.launch_date < today) clean.launch_date = '';
  if (!/^\d+$/.test(clean.product_count)) clean.product_count = '';
  if (!/^\d+$/.test(clean.portfolio_count)) clean.portfolio_count = '';

  // Same gates as the form, enforced here too.
  const missing = [];
  const need = (cond, label) => { if (cond) missing.push(label); };
  need(clean.name.length < 2, 'name');
  need(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean.email), 'email');
  need(!clean.contact_pref, 'best way to reach you');
  need(['Text', 'Call'].includes(clean.contact_pref) && clean.phone.replace(/\D/g, '').length < 10, 'phone');
  need(clean.about.length < 15, 'what you do');
  need(!clean.current_platform, 'current website');
  need(clean.current_platform === 'Other' && !clean.current_platform_other, 'which platform');
  need(!clean.domain, 'domain');
  need(clean.domain.startsWith('Yes') && !clean.domain_name, 'domain name');
  need(clean.domain === "Yes, and I know where it's registered" && !clean.domain_registrar, 'where the domain is registered');
  need(has('tools', 'Other') && !clean.tools_other, 'other tools');
  need(!clean.needs.length, 'what the site needs to do');
  need(has('needs', 'Something else') && !clean.needs_other, 'what else the site should do');
  need(clean.primary_action.length < 3, 'the one thing visitors should do');
  need(booking && !clean.booking_what, 'what gets booked');
  need(booking && !clean.deposits, 'deposits');
  need(store && !clean.product_count, 'number of products');
  need(store && !clean.fulfillment.length, 'how orders get to customers');
  need(has('pages', 'Other') && !clean.pages_other, 'other pages');
  need(!clean.copy_ready, 'website copy');
  need(!clean.photos_ready, 'photos');
  need(!clean.logo, 'logo');
  need(!clean.budget, 'budget');
  need(!clean.launch_timing, 'when you need the site live');
  need(dated && !clean.launch_date, 'launch date');
  need(dated && !clean.date_firm, 'whether the date is firm');
  need(dated && clean.launch_reason.length < 3, 'what the date is tied to');
  if (missing.length) return json({ error: `Missing: ${missing.join(', ')}` }, 400);

  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE || !env.AIRTABLE_TABLE) {
    return json({ error: 'Form not configured' }, 503);
  }

  const fields = { Status: 'New' };
  for (const [k, f] of TEXT) if (clean[k]) fields[f] = clean[k];
  for (const [k, [f]] of Object.entries(CHOICES)) if (clean[k]) fields[f] = clean[k];
  for (const [k, [f]] of Object.entries(MULTI_CHOICES)) if (clean[k].length) fields[f] = clean[k];
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

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function niceDate(v) {
  return v ? new Date(v + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
}

async function sendThanks(env, c) {
  const first = firstName(c.name);
  const onTheHouse = c.budget === 'Applying for On the House';
  const steps = [
    "Within three business days, I'll email you a fixed-price quote, or a few questions if anything needs clearing up.",
    onTheHouse
      ? 'You applied for On the House. I read every application myself and will let you know either way when I reply. Applying doesn\'t commit you to anything.'
      : 'If the quote works for you, a 50% deposit holds your spot and I start building.',
    "You'll review a working preview on your own phone before anything goes live."
  ];
  const timing =
    c.launch_timing === 'By a specific date' && c.launch_date
      ? `Your launch date is ${niceDate(c.launch_date)} (${cap(c.launch_reason.replace(/[.\s]+$/, ''))}). I'll confirm in my reply whether that timeline works.`
      : c.launch_timing === 'As soon as possible'
        ? "You'd like to launch as soon as possible. My reply will include the earliest start date I can give you."
        : '';
  const before = [`Hi ${first},`, 'Thank you for sending this over. Your answers are in, and the next move is mine.', "Here's what happens next:"];
  const after = [
    ...(timing ? [timing] : []),
    'No calls needed. If you\'d like one, reply and say so.',
    'Need to add something or change an answer? Reply to this email. It comes straight to me.',
    'A copy of what you sent is below, for your records.'
  ];
  const p = (t) => `<p style="margin:0 0 16px">${esc(t)}</p>`;
  await send(env, {
    to: c.email,
    reply_to: 'hello@sianicreates.com',
    subject: "Your project is in. Here's what happens next.",
    text: [...before, steps.map((s, n) => `${n + 1}. ${s}`).join('\n'), ...after].join('\n\n') +
      '\n\nTalk soon,\nSiani\nSiani Creates · sianicreates.com\n\n---\nYOUR ANSWERS\n\n' +
      answers(c).map(([l, v]) => `${l}: ${v}`).join('\n'),
    html: layout(
      before.map(p).join('') +
      `<ol style="margin:0 0 18px;padding-left:22px">${steps.map((s) => `<li style="margin:0 0 8px">${esc(s)}</li>`).join('')}</ol>` +
      after.map(p).join('') +
      '<p style="margin:24px 0 0">Talk soon,<br>Siani</p>',
      table(answers(c), 'Your answers'),
      'Your quote arrives within three business days.'
    )
  });
}

async function sendAlert(env, c, recId) {
  const link = recId ? `https://airtable.com/${env.AIRTABLE_BASE}/${env.AIRTABLE_TABLE_ID || 'tblRJ8x6XxWm9SD9t'}/${recId}` : '';
  const firm = c.launch_timing === 'By a specific date' && c.date_firm === 'Firm' && c.launch_date
    ? `Firm date ${new Date(c.launch_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}` : '';
  const head = [c.name, c.business, c.tier, c.budget, firm].filter(Boolean).join(' · ');
  const timing = c.launch_timing === 'By a specific date'
    ? `${niceDate(c.launch_date)} (${c.date_firm || 'firmness not given'}), for ${c.launch_reason}` : c.launch_timing;
  const summary = [['Starting point', c.tier], ['Budget', c.budget], ['Launch', timing], ['Reach them by', c.contact_pref + (c.phone ? ` · ${c.phone}` : '')]].filter(([, v]) => v);
  await send(env, {
    to: env.NOTIFY_EMAIL || 'hello@sianicreates.com',
    reply_to: c.email,
    subject: `New project: ${head}`,
    text: `${head}\n\n` + summary.map(([l, v]) => `${l}: ${v}`).join('\n') + '\n\n' +
      answers(c).map(([l, v]) => `${l}: ${v}`).join('\n') + (link ? `\n\nOpen in Airtable: ${link}` : ''),
    html: layout(
      `<p style="margin:0 0 6px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#2F55FF;font-weight:700">New project</p>` +
      `<p style="margin:0 0 18px;font-size:22px;font-weight:700;color:#0E0E10">${esc([c.name, c.business].filter(Boolean).join(' · '))}</p>` +
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px">${summary.map(([l, v]) =>
        `<tr><td style="padding:3px 16px 3px 0;font-size:13px;color:#6B6B73">${esc(l)}</td><td style="padding:3px 0;font-size:15px;font-weight:600;color:#0E0E10">${esc(v)}</td></tr>`).join('')}</table>` +
      `<p style="margin:0">Reply to this email to answer ${esc(firstName(c.name))} directly.</p>` +
      (link ? `<p style="margin:20px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#0E0E10;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Open in Airtable</a></p>` : ''),
      table(answers(c), 'Their answers'),
      `${c.tier} · ${c.budget}`
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

function layout(top, bottom, preheader = '') {
  return `<!DOCTYPE html><html><body style="margin:0;background:#F6F5F1">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>
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
