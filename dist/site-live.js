// Connects the static pages to the site's server (Cloudflare Pages Functions under /api).
// Every part fails quietly: if the server can't be reached, the page keeps working as it was.
(() => {
  const root = document.documentElement;
  const path = location.pathname;
  const esc = (v) => { const n = document.createElement('span'); n.textContent = v == null ? '' : String(v); return n.innerHTML; };
  const api = (url, opts) => fetch(url, opts).then((r) => (r.ok ? r.json() : Promise.reject(r)));
  const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });

  // ---- Error reports (max 5 per page view) ----
  let reported = 0;
  const report = (message, extra = {}) => {
    if (reported++ >= 5) return;
    try {
      fetch('/api/error', { method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ page: path + location.search, message: String(message).slice(0, 500), ...extra }) });
    } catch {}
  };
  addEventListener('error', (e) => {
    if (e.target && e.target !== window && (e.target.src || e.target.href)) return report('Could not load ' + (e.target.src || e.target.href));
    report(e.message, { source: e.filename, line: e.lineno, stack: e.error?.stack?.slice(0, 1500) });
  }, true);
  addEventListener('unhandledrejection', (e) => report('Unhandled: ' + (e.reason?.message || e.reason), { stack: e.reason?.stack?.slice(0, 1500) }));

  // ---- Anonymous visit count (skipped when the browser asks not to be tracked) ----
  if (navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl) {
    try { navigator.sendBeacon('/api/hit', new Blob([JSON.stringify({ path })], { type: 'application/json' })); } catch {}
  }

  // ---- Switches from the admin page ----
  const applySwitches = (s) => {
    try { localStorage.setItem('whs-switches', JSON.stringify(s)); } catch {}
    for (const [k, on] of Object.entries(s.sections || {})) root.classList.toggle('sw-off-' + k, !on);
    root.classList.toggle('sw-no-welcome', !s.welcome);
    const dlg = document.querySelector('#welcome');
    if (!s.welcome && dlg?.open) dlg.close();
    let bar = document.querySelector('.site-banner');
    if (s.banner && s.bannerText) {
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'site-banner';
        bar.setAttribute('role', 'status');
        const header = document.querySelector('body > header');
        header ? header.after(bar) : document.body.prepend(bar);
      }
      bar.innerHTML = s.bannerLink ? `<a href="${esc(s.bannerLink)}">${esc(s.bannerText)} <span aria-hidden="true">→</span></a>` : `<span>${esc(s.bannerText)}</span>`;
    } else bar?.remove();
    document.querySelectorAll('form[data-live-form]').forEach((f) => setFormOpen(f, s.forms?.[f.dataset.liveForm] !== false));
  };

  // ---- Forms ----
  const setFormOpen = (form, open) => {
    let note = form.querySelector('.live-form-closed');
    form.querySelectorAll('input, textarea, select, button').forEach((c) => { c.disabled = !open; });
    if (!open && !note) {
      note = document.createElement('p');
      note.className = 'live-form-closed';
      note.setAttribute('role', 'note');
      note.textContent = 'This form is closed right now. Please check back later.';
      form.prepend(note);
    } else if (open) note?.remove();
  };

  document.querySelectorAll('form[data-live-form]').forEach((form) => {
    const type = form.dataset.liveForm;
    const eventSel = form.querySelector('select[name="event_slug"]');
    const otherWrap = form.querySelector('#event-other-wrap');
    if (eventSel && otherWrap) {
      const syncOther = () => {
        const on = eventSel.value === 'other';
        otherWrap.hidden = !on;
        otherWrap.querySelector('input').required = on;
        if (on) otherWrap.querySelector('input').focus();
      };
      eventSel.addEventListener('change', syncOther);
      form.addEventListener('reset', () => setTimeout(() => { otherWrap.hidden = true; otherWrap.querySelector('input').required = false; }));
    }
    const status = document.createElement('div');
    status.className = 'live-form-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    form.append(status);
    const MAX = 10 * 1024 * 1024;
    const showFieldErrors = (out) => {
      let first = null;
      for (const [name, msg] of Object.entries(out.fields || {})) {
        const field = form.querySelector(`[name="${CSS.escape(name)}"]`);
        if (!field) continue;
        field.setAttribute('aria-invalid', 'true');
        const p = document.createElement('p');
        p.className = 'live-field-error';
        p.textContent = msg;
        (field.closest('label') || field).after(p);
        first ||= field;
      }
      first?.focus();
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      form.querySelectorAll('.live-field-error').forEach((n) => n.remove());
      form.querySelectorAll('[aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
      const fileInput = form.querySelector('input[type=file]');
      const files = [...(fileInput?.files || [])];
      const tooBig = files.filter((f) => f.size > MAX);
      if (tooBig.length) {
        status.className = 'live-form-status bad';
        status.textContent = (tooBig.length === 1 ? `“${tooBig[0].name}” is` : `${tooBig.length} of your photos are`) + ' over 10MB. Please remove ' + (tooBig.length === 1 ? 'it' : 'them') + ' or pick smaller copies.';
        return;
      }
      const button = form.querySelector('button[type=submit]');
      const label = button?.textContent;
      if (button) button.disabled = true;
      status.className = 'live-form-status';
      status.textContent = '';
      // Several photos are sent one at a time, so there's no limit on how many you can pick.
      const many = files.length > 1;
      const rounds = many ? files : [null];
      let sent = 0;
      const failed = [];
      try {
        for (let i = 0; i < rounds.length; i++) {
          const body = new FormData(form);
          if (many) {
            body.delete(fileInput.name);
            body.append(fileInput.name, rounds[i]);
            status.textContent = `Uploading photo ${i + 1} of ${rounds.length}…`;
          }
          if (button) button.textContent = many ? `Uploading ${i + 1} of ${rounds.length}…` : 'Sending…';
          const res = await fetch('/api/submit/' + type, { method: 'POST', body });
          const out = await res.json().catch(() => ({}));
          if (res.ok) { sent++; continue; }
          const otherFieldErrors = Object.keys(out.fields || {}).some((k) => !fileInput || k !== fileInput.name);
          if (!many || otherFieldErrors || res.status === 429 || res.status === 403 || !out.fields) {
            // A problem with the form itself (or the server said stop): show it and stop here.
            status.className = 'live-form-status bad';
            status.textContent = (sent ? `${sent} photo${sent === 1 ? ' was' : 's were'} sent, then this happened: ` : '') + (out.error || 'Something went wrong. Please try again.');
            showFieldErrors(out);
            return;
          }
          failed.push(`${rounds[i].name} (${out.fields[fileInput.name] || 'could not be uploaded'})`);
        }
        if (!failed.length) form.reset();
        status.className = 'live-form-status ' + (failed.length && !sent ? 'bad' : 'good');
        const thanks = {
          photo: sent > 1 ? `Thanks! All ${sent} photos are in. The site team reviews every photo before it goes on the site.` : 'Thanks! Your photo is in. The site team reviews every photo before it goes on the site.',
          spotlight: 'Thanks! Your nomination is in. We always ask the senior before featuring them.',
          directory: 'Thanks! You’ll appear in the directory once a moderator approves your entry.',
          announcement: 'Thanks! An editor will read your request before anything is posted.',
          contact: 'Thanks! Your message was sent. A real senior will reply, usually within a few school days.',
          newsletter: 'You’re on the list. Emails start when notifications launch.',
        }[type] || 'Thanks! Sent.';
        status.textContent = failed.length
          ? `${sent} of ${rounds.length} photos were sent. These didn’t upload: ${failed.join('; ')}.`
          : thanks;
        status.scrollIntoView({ block: 'nearest' });
      } catch {
        status.className = 'live-form-status bad';
        status.textContent = (sent ? `${sent} photo${sent === 1 ? ' was' : 's were'} sent, but then ` : '') + 'we could not reach the server. Check your connection and try again.';
      } finally {
        if (button) { button.disabled = false; button.textContent = label; }
      }
    });
  });

  api('/api/settings').then(applySwitches).catch(() => {});

  // ---- Approved photos: gallery page and homepage strip ----
  const lightbox = (p) => {
    let d = document.querySelector('#live-lightbox');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'live-lightbox';
      d.className = 'live-lightbox';
      document.body.append(d);
      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    }
    d.innerHTML = `<form method="dialog"><button class="live-lightbox-close" aria-label="Close">×</button></form>
      <img src="/api/photo/${esc(p.id)}" alt="${esc(p.caption || 'Class photo')}">
      <div class="live-lightbox-text">${p.eventName ? `<p class="muted">${esc(p.eventName)}</p>` : ''}<p>${esc(p.caption)}</p><p class="muted">${p.credit ? 'Photo: ' + esc(p.credit) + ' · ' : ''}${esc(dateFmt.format(new Date(p.date)))}</p>
      ${p.download ? `<a class="btn-outline" href="/api/photo/${esc(p.id)}?download">Download</a>` : ''}</div>`;
    d.showModal();
  };
  const isGallery = /^\/gallery\/?$/.test(path);
  const isHome = path === '/' || path === '/index.html';
  if (isGallery || isHome) {
    api('/api/photos').then(({ photos }) => {
      if (!photos?.length) return;
      const viewable = photos.filter((p) => p.type !== 'image/heic');
      if (isHome) {
        const grid = document.querySelector('[data-sw="photos"] .grid');
        if (!grid) return;
        grid.innerHTML = viewable.slice(0, 6).map((p) => `<div><a class="card-hover block overflow-hidden rounded-2xl border border-line" href="/gallery"><img src="/api/photo/${esc(p.id)}" alt="${esc(p.caption || 'Class photo')}" loading="lazy" class="aspect-square w-full object-cover"></a></div>`).join('');
        return;
      }
      const q = new URLSearchParams(location.search);
      const ev = q.get('event');
      const month = q.get('month');
      const shown = viewable.filter((p) => (!ev || p.event === ev) && (!month || String(p.date).slice(0, 7) === month));
      const grid = document.querySelector('main .grid.grid-cols-2');
      const count = document.querySelector('main [role=status] span');
      if (!grid) return;
      if (count) count.textContent = `${shown.length} photo${shown.length === 1 ? '' : 's'}`;
      grid.innerHTML = shown.length ? shown.map((p, i) => `<button type="button" data-photo="${i}" class="card-hover group overflow-hidden rounded-2xl border border-line bg-card text-left ${i === 0 ? 'col-span-2 row-span-2' : ''}" aria-label="Open photo: ${esc(p.caption || 'Class photo')}"><img src="/api/photo/${esc(p.id)}" alt="${esc(p.caption || 'Class photo')}" loading="lazy" class="aspect-square h-full w-full object-cover transition group-hover:scale-[1.02]"></button>`).join('')
        : '<p class="text-muted">No photos match this filter yet.</p>';
      grid.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => lightbox(shown[b.dataset.photo])));
      // Rebuild the event/month filters from the approved photos.
      const navs = document.querySelectorAll('main nav[aria-label="Event"], main nav[aria-label="Month"]');
      const NAMES = { 'first-day-of-senior-year': 'First Day of Senior Year', 'football-senior-night-2026': 'Football Senior Night', 'parent-teacher-conferences-fall-2026': 'Parent-Teacher Conferences',
        'basketball-season-2026-27': 'Basketball Season', 'winter-break-2026': 'Winter Break', 'spring-break-2027': 'Spring Break', 'last-day-of-classes-2027': 'Last Day of Classes',
        'graduation-2027': 'Graduation', 'homecoming-2026': 'Homecoming', 'prom-2027': 'Prom', other: 'Other' };
      const label = (slug) => NAMES[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const pills = (key, values, nameOf, anyLabel) => {
        const cur = q.get(key);
        return `<span class="mr-1 text-xs font-bold uppercase tracking-wider text-muted">${key === 'event' ? 'Event' : 'Month'}</span>` +
          `<a class="pill ${!cur ? 'pill-on' : ''}" ${!cur ? 'aria-current="page"' : ''} href="?${new URLSearchParams([...q].filter(([k]) => k !== key))}">${anyLabel}</a>` +
          values.map((v) => { const p = new URLSearchParams(q); p.set(key, v); return `<a class="pill ${cur === v ? 'pill-on' : ''}" ${cur === v ? 'aria-current="page"' : ''} href="?${p}">${esc(nameOf(v))}</a>`; }).join('');
      };
      const events = [...new Set(viewable.map((p) => p.event).filter(Boolean))];
      const months = [...new Set(viewable.map((p) => String(p.date).slice(0, 7)))].sort().reverse();
      if (navs[0]) navs[0].innerHTML = pills('event', events, label, 'All');
      if (navs[1]) navs[1].innerHTML = pills('month', months, (m) => new Date(m + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }), 'Any');
    }).catch(() => {});
  }

  // ---- Class News posts written on the admin page ----
  const fmtPostDate = (iso) => dateFmt.format(new Date(iso));
  if (/^\/announcements\/?$/.test(path)) {
    api('/api/posts').then(({ posts }) => {
      if (!posts?.length) return;
      const grid = document.querySelector('main .grid.gap-3');
      if (!grid) return;
      grid.insertAdjacentHTML('afterbegin', posts.map((p) => `<a class="card card-hover flex flex-col p-5 no-underline" href="/announcements/post/?id=${esc(p.id)}"><div class="flex items-center gap-2"><span class="chip ${p.pinned ? 'chip-gold' : ''}">${esc(p.category)}</span>${p.pinned ? '<span class="chip chip-muted">Pinned</span>' : ''}</div><h3 class="mt-2.5 text-[17px] font-extrabold leading-snug tracking-tight">${esc(p.title)}</h3><p class="mt-1.5 line-clamp-3 text-sm text-muted">${esc(p.summary)}</p><p class="mt-auto pt-4 text-xs font-semibold text-muted">${fmtPostDate(p.created_at)}</p></a>`).join(''));
      const showing = [...document.querySelectorAll('main span.text-sm.text-muted')].find((s) => /Showing/.test(s.textContent));
      if (showing) { const n = grid.parentElement.querySelectorAll('a.card').length; showing.textContent = `Showing ${n} of ${n} stories`; }
    }).catch(() => {});
  }
  const postBox = document.querySelector('#live-post');
  if (postBox) {
    const id = new URLSearchParams(location.search).get('id');
    api('/api/posts').then(({ posts }) => {
      const p = posts.find((x) => x.id === id);
      if (!p) { postBox.innerHTML = '<h1 class="display mt-3 text-4xl">Story not found</h1><p class="deck mt-4">It may have been taken down.</p><p class="mt-5"><a class="btn-ghost" href="/announcements">← All news</a></p>'; return; }
      document.title = p.title + ' · WHS Class of 2027';
      const paras = p.body.split(/\n{2,}/).map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`).join('');
      postBox.innerHTML = `<div class="flex flex-wrap items-center gap-1.5"><span class="chip ${p.pinned ? 'chip-gold' : ''}">${esc(p.category)}</span></div>
        <h1 class="display mt-3 max-w-3xl text-4xl sm:text-5xl">${esc(p.title)}</h1>${p.summary ? `<p class="deck mt-4 max-w-3xl">${esc(p.summary)}</p>` : ''}
        <p class="mt-4 text-sm text-muted">Posted <time datetime="${esc(p.created_at)}">${fmtPostDate(p.created_at)}</time></p>
        <div class="card mt-6 max-w-3xl p-6 sm:p-8"><div class="prose-md">${paras}</div></div>
        <div class="mt-5 flex max-w-3xl flex-wrap items-center gap-2"><a class="btn-ghost" href="/announcements">← All news</a></div>`;
    }).catch(() => { postBox.innerHTML = '<p class="deck">This story could not be loaded. Please try again.</p>'; });
  }

  // ---- Events page: redraw from the admin's edited list, if there is one ----
  if (/^\/events\/?$/.test(path)) {
    api('/api/content/calendar').then(({ value }) => {
      if (!value) return;
      const section = document.querySelector('[data-section="school"]');
      if (!section) return;
      section.querySelectorAll('.calendar-month').forEach((m) => m.remove());
      const short = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      const months = new Map();
      for (const r of value) { const k = r[0].slice(0, 7); if (!months.has(k)) months.set(k, []); months.get(k).push(r); }
      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Chicago' }).format(new Date()).slice(0, 7);
      const openKey = [...months.keys()].find((k) => k >= today) || [...months.keys()].pop();
      const html = [...months].map(([k, rows]) => `<details class="calendar-month"${k === openKey ? ' open' : ''}><summary>${new Date(k + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</summary><div class="fixtures">` +
        rows.map(([start, title, url, details, end]) => {
          const id = (url.split('#')[1] || '').replace(/[^A-Za-z0-9_-]/g, '');
          return `<article class="fixture"${id ? ` id="${id}"` : ''}><div><h3>${esc(title)}</h3><p>${short(start)}${end && end !== start ? ' – ' + short(end) : ''}</p>${details ? `<p>${esc(details)}</p>` : ''}</div></article>`;
        }).join('') + '</div></details>').join('');
      section.insertAdjacentHTML('beforeend', html);
      if (location.hash) dispatchEvent(new HashChangeEvent('hashchange'));
    }).catch(() => {});
  }
})();
