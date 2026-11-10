// Siani Creates: nav state and the multi-step intake form.
(() => {
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const form = document.getElementById('intake');
  if (!form) return;

  // Tier buttons in Pricing carry the choice into the form.
  const tierInput = document.getElementById('tier');
  document.querySelectorAll('[data-tier]').forEach((a) => {
    a.addEventListener('click', () => { tierInput.value = a.dataset.tier; });
  });

  const steps = [...form.querySelectorAll('.step')];
  const bar = document.getElementById('bar');
  const count = document.getElementById('stepcount');
  const back = document.getElementById('back');
  const next = document.getElementById('next');
  const send = document.getElementById('send');
  const err = document.getElementById('err');
  let i = 0;

  // Chip groups: single (radio) or multi select, stored on the group element.
  form.querySelectorAll('.chips').forEach((group) => {
    const multi = group.dataset.type === 'multi';
    group.setAttribute('role', 'group');
    group.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') === 'true';
        if (!multi) group.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', String(multi ? !on : true));
        if (group.dataset.name === 'needs') syncReveals();
      });
    });
  });

  // Show booking, shop and portfolio questions only when they apply.
  function syncReveals() {
    const want = new Set(
      [...form.querySelectorAll('[data-name="needs"] button[aria-pressed="true"]')]
        .map((b) => b.dataset.reveal).filter(Boolean)
    );
    form.querySelectorAll('.reveal').forEach((r) => { r.hidden = !want.has(r.dataset.group); });
  }

  const chipValue = (group) => {
    const picked = [...group.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent.trim());
    return group.dataset.type === 'multi' ? picked : (picked[0] || '');
  };

  function validate(step) {
    for (const el of step.querySelectorAll('input[required],textarea[required]')) {
      if (!el.value.trim()) { el.focus(); return 'Please fill in the fields marked with *.'; }
      if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim())) { el.focus(); return 'That email address looks off.'; }
    }
    for (const g of step.querySelectorAll('.chips[data-required]')) {
      if (!chipValue(g).length) { g.querySelector('button').focus(); return 'Please pick an option for the questions marked with *.'; }
    }
    return '';
  }

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

  next.addEventListener('click', () => {
    const m = validate(steps[i]);
    if (m) { err.textContent = m; return; }
    show(i + 1);
  });
  back.addEventListener('click', () => show(i - 1));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = validate(steps[i]);
    if (m) { err.textContent = m; return; }

    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    form.querySelectorAll('.chips').forEach((g) => {
      const reveal = g.closest('.reveal');
      if (reveal && reveal.hidden) return;
      data[g.dataset.name] = chipValue(g);
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
      else if (!res.ok) throw new Error('save failed');
    } catch (x) {
      if (location.protocol === 'file:' || !/^https?:$/.test(location.protocol) || x instanceof TypeError) target = 'preview';
      else {
        err.textContent = 'Something went wrong sending your answers. Please try again in a minute.';
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
