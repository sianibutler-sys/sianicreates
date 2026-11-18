// Cloudflare Pages Function: POST /api/accept
// A client accepts a proposal page under /p/. Sends Siani an alert and the client a confirmation
// through Resend. Uses the same RESEND_API_KEY and NOTIFY_EMAIL as /api/intake. Nothing is stored.

const FROM = 'Siani Creates <hello@sianicreates.com>';
const SITE = 'https://sianicreates.com';

// Proposals that can be accepted, and what accepting means. Add a line for each new proposal page.
const PROPOSALS = {
  'musicat-yebqhv': { client: 'Musicat TV', phase: 'Phase 1: Foundation', price: '$4,000, paid as $1,400 at signing, $1,300 when the week 3–4 drafts arrive and $1,300 at handoff' }
};

export async function onRequestPost({ request, env, waitUntil }) {
  let d;
  try { d = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  if (d.company_site) return json({ ok: true }); // honeypot

  const p = PROPOSALS[str(d.proposal)];
  const name = str(d.name).slice(0, 120);
  const email = str(d.email).slice(0, 160);
  const note = str(d.note).slice(0, 2000);
  if (!p) return json({ error: 'Unknown proposal' }, 400);
  if (name.length < 2) return json({ error: 'Missing name' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'Missing email' }, 400);
  if (d.agree !== true) return json({ error: 'Not accepted' }, 400);
  if (!env.RESEND_API_KEY) return json({ error: 'Not configured' }, 503);

  const when = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' });
  const link = `${SITE}/p/${str(d.proposal)}/`;
  const rows = [['Proposal', p.client], ['Accepted', p.phase], ['Price', p.price], ['Name', name], ['Email', email], ['When', `${when} ET`], ...(note ? [['Note', note]] : [])];

  const alert = send(env, {
    to: env.NOTIFY_EMAIL || 'hello@sianicreates.com',
    reply_to: email,
    subject: `Accepted: ${p.client} · ${p.phase}`,
    text: rows.map(([l, v]) => `${l}: ${v}`).join('\n') + `\n\nProposal: ${link}\n\nNext: send the service agreement to sign, then the secure payment link for the first payment.`,
    html: layout(
      `<p style="margin:0 0 6px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#5B2A86;font-weight:700">Proposal accepted</p>` +
      `<p style="margin:0 0 18px;font-size:22px;font-weight:700;color:#0E0E10">${esc(p.client)} · ${esc(p.phase)}</p>` +
      table(rows) +
      `<p style="margin:20px 0 0">Next: send the service agreement to sign, then the secure payment link for the first payment. Reply to this email to answer ${esc(firstName(name))} directly.</p>`
    )
  });

  const first = firstName(name);
  const confirm = send(env, {
    to: email,
    reply_to: 'hello@sianicreates.com',
    subject: `You accepted ${p.phase}`,
    text: `Hi ${first},\n\nYour acceptance of ${p.phase} for ${p.client} is in. Next, I'll send a service agreement for you to sign. Once it's signed, a secure link for the first payment follows, and we set the kickoff date.\n\nPrice: ${p.price}\nProposal: ${link}\n\nQuestions? Reply to this email. It comes straight to me.\n\nTalk soon,\nSiani\nSiani Creates · sianicreates.com`,
    html: layout(
      `<p style="margin:0 0 16px">Hi ${esc(first)},</p>` +
      `<p style="margin:0 0 16px">Your acceptance of ${esc(p.phase)} for ${esc(p.client)} is in. Next, I'll send a service agreement for you to sign. Once it's signed, a secure link for the first payment follows, and we set the kickoff date.</p>` +
      table([['Accepted', p.phase], ['Price', p.price], ['When', `${when} ET`]]) +
      `<p style="margin:20px 0 16px"><a href="${esc(link)}" style="color:#5B2A86;font-weight:600">Open your proposal</a></p>` +
      `<p style="margin:0 0 16px">Questions? Reply to this email. It comes straight to me.</p>` +
      `<p style="margin:24px 0 0">Talk soon,<br>Siani</p>`
    )
  });

  const mail = Promise.all([alert, confirm]);
  if (waitUntil) waitUntil(mail); else await mail;
  return json({ ok: true });
}

async function send(env, msg) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [msg.to], reply_to: msg.reply_to, subject: msg.subject, text: msg.text, html: msg.html })
  });
  if (!r.ok) console.log('email failed', r.status, await r.text());
}

function layout(body) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#F6F5F1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F1"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E3E1DA;border-radius:14px;overflow:hidden">
<tr><td style="background:#0E0E10;padding:22px 32px;border-top:5px solid #E0407F"><img src="${SITE}/assets/img/siani-creates.png" width="72" alt="Siani Creates" style="display:block;border:0;height:auto"></td></tr>
<tr><td style="padding:32px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#3A3A40">${body}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #E3E1DA;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6B6B73">Siani Creates · <a href="${SITE}" style="color:#5B2A86;text-decoration:none">sianicreates.com</a></td></tr>
</table></td></tr></table></body></html>`;
}

function table(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E3E1DA">${rows.map(([l, v]) =>
    `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid #E3E1DA;font-size:13px;color:#6B6B73;vertical-align:top;width:30%">${esc(l)}</td><td style="padding:10px 0;border-bottom:1px solid #E3E1DA;font-size:14px;color:#0E0E10;vertical-align:top;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table>`;
}

function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || 'there';
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
