// Siani Creates: nav state and the multi-step intake form.
(() => {
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const form = document.getElementById('intake');
  if (!form) return;

  const steps = [...form.querySelectorAll('.step')];
  const bar = document.getElementById('bar');
  const count = document.getElementById('stepcount');
  const back = document.getElementById('back');
  const next = document.getElementById('next');
  const send = document.getElementById('send');
  const err = document.getElementById('err');
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  let i = 0;

  // ---------- chips ----------
  const group = (name) => form.querySelector(`.chips[data-name="${name}"]`);
  const picked = (g) => [...g.querySelectorAll('button[aria-pressed="true"]')];
  const chipValue = (g) => {
    const v = picked(g).map((b) => b.textContent.trim());
    return g.dataset.type === 'multi' ? v : (v[0] || '');
  };
  const setChip = (g, label) => g.querySelectorAll('button').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.textContent.trim() === label)));

  form.querySelectorAll('.chips').forEach((g) => {
    const multi = g.dataset.type === 'multi';
    g.setAttribute('role', 'group');
    g.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') === 'true';
        if (!multi) {
          g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
        } else {
          b.setAttribute('aria-pressed', String(!on));
          // "None yet" / "Not sure yet" can't sit next to a real answer.
          if (!on && b.hasAttribute('data-exclusive')) {
            g.querySelectorAll('button:not([data-exclusive])').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          } else if (!on) {
            g.querySelectorAll('button[data-exclusive]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          }
        }
        clearFlag(g.closest('.q') || g);
        syncConds();
        if (g.dataset.name === 'contact_pref') syncPhone();
      });
    });
  });

  // Follow-up questions appear only when a chip that needs them is picked.
  function syncConds() {
    const want = new Set();
    form.querySelectorAll('button[data-reveals][aria-pressed="true"]').forEach((b) =>
      b.dataset.reveals.split(/\s+/).forEach((id) => want.add(id)));
    form.querySelectorAll('.cond').forEach((el) => {
      const show = want.has(el.id);
      el.hidden = !show;
      if (!show) {
        // Clear hidden answers so stale data never gets sent.
        el.querySelectorAll('input,textarea').forEach((x) => { x.value = ''; clearFlag(x.closest('.f')); });
        el.querySelectorAll('.chips button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      }
    });
  }

  // Phone becomes required when they'd rather get a text or a call.
  const phone = form.elements.phone;
  function syncPhone() {
    const need = ['Text', 'Call'].includes(chipValue(group('contact_pref')));
    phone.required = need;
    form.querySelector('.if-phone').hidden = !need;
    if (!need) clearFlag(phone.closest('.f'));
  }

  // Pricing and case study buttons pass ?tier= so the last step starts preselected.
  const tierParam = new URLSearchParams(location.search).get('tier');
  if (tierParam) setChip(group('tier'), tierParam);

  // ---------- validation ----------
  const visible = (el) => !el.closest('[hidden]');

  function flag(box, msg) {
    if (!box) return;
    box.classList.add('is-bad');
    let m = box.querySelector(':scope > .fielderr');
    if (!m) { m = document.createElement('p'); m.className = 'fielderr'; box.appendChild(m); }
    m.textContent = msg;
    const input = box.querySelector('input,textarea');
    if (input) input.setAttribute('aria-invalid', 'true');
  }
  function clearFlag(box) {
    if (!box) return;
    box.classList.remove('is-bad');
    box.querySelector(':scope > .fielderr')?.remove();
    box.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid');
  }
  form.addEventListener('input', (e) => {
    clearFlag(e.target.closest('.f'));
    if (!form.querySelector('.is-bad')) err.textContent = '';
  });

  function normalizeUrl(input) {
    let v = input.value.trim();
    if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v;
    input.value = v;
    return v;
  }

  function checkInput(el) {
    const v = el.value.trim();
    el.value = el.tagName === 'TEXTAREA' ? el.value.replace(/^\s+|\s+$/g, '') : v;
    const label = el.closest('.f');
    if (el.required && !v) return flag(label, 'This one is required.'), false;
    if (!v) return true;
    if (el.minLength > 0 && v.length < el.minLength) return flag(label, `A little more detail, please (at least ${el.minLength} characters).`), false;
    if (el.type === 'email' && !EMAIL.test(v)) return flag(label, 'That email address looks off.'), false;
    if (el.type === 'tel' && v.replace(/\D/g, '').length < 10) return flag(label, 'Please include the area code.'), false;
    if (el.type === 'url') {
      try { const u = new URL(normalizeUrl(el)); if (!u.hostname.includes('.')) throw 0; }
      catch { return flag(label, 'Paste the full share link.'), false; }
    }
    if (el.pattern && !new RegExp(`^(?:${el.pattern})$`).test(v)) return flag(label, 'Numbers only, please.'), false;
    if (el.type === 'date') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(v + 'T00:00:00') < today) return flag(label, 'Pick a date from today on.'), false;
    }
    return true;
  }

  function validate(step) {
    let ok = true;
    step.querySelectorAll('input:not(.hp),textarea').forEach((el) => {
      if (visible(el) && !checkInput(el)) ok = false;
    });
    step.querySelectorAll('.chips[data-required]').forEach((g) => {
      if (visible(g) && !chipValue(g).length) {
        flag(g.closest('.q'), g.dataset.type === 'multi' ? 'Pick at least one.' : 'Pick one.');
        ok = false;
      }
    });
    if (!ok) {
      err.textContent = 'A few answers need a look before you continue.';
      step.querySelector('.is-bad input, .is-bad textarea, .is-bad button')?.focus();
    }
    return ok;
  }

  // ---------- steps ----------
  function show(n) {
    steps[i].classList.remove('is-on');
    i = n;
    steps[i].classList.add('is-on');
    bar.style.width = ((i + 1) / steps.length) * 100 + '%';
    count.textContent = `Step ${i + 1} of ${steps.length}`;
    back.hidden = i === 0;
    next.hidden = i === steps.length - 1;
    send.hidden = i !== steps.length - 1;
    err.textContent = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  next.addEventListener('click', () => { if (validate(steps[i])) show(i + 1); });
  back.addEventListener('click', () => show(i - 1));

  // ---------- submit ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate(steps[i])) return;
    // Re-check every step in case something changed after it was passed.
    for (let s = 0; s < steps.length; s++) {
      if (!validate(steps[s])) { show(s); validate(steps[s]); return; }
    }

    const data = {};
    form.querySelectorAll('input[name],textarea[name]').forEach((el) => {
      if (el.classList.contains('hp')) { data[el.name] = el.value; return; }
      if (visible(el) && el.value.trim()) data[el.name] = el.value.trim();
    });
    form.querySelectorAll('.chips').forEach((g) => {
      if (!visible(g)) return;
      const v = chipValue(g);
      if (v.length) data[g.dataset.name] = v;
    });

    send.disabled = true;
    send.textContent = 'Sending…';
    let target = 'done';
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.status === 404 || res.status === 405) target = 'preview';
      else if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'save failed');
      }
    } catch (x) {
      if (location.protocol === 'file:' || x instanceof TypeError) target = 'preview';
      else {
        err.textContent = `Something went wrong sending your answers (${x.message}). Please try again in a minute.`;
        send.disabled = false; send.textContent = 'Send';
        return;
      }
    }
    form.hidden = true;
    const box = document.getElementById(target);
    box.hidden = false;
    box.focus();
  });
})();
