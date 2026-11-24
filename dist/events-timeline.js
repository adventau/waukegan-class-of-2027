// Events page timeline, built from schoolCalendar (school-calendar.js; the admin page can edit it).
// Row: [start date, title, link, details, end date]
(() => {
  const box = document.getElementById('timeline');
  if (!box || typeof schoolCalendar === 'undefined') return;
  const fallback = document.getElementById('timeline-fallback');

  const TZ = 'America/Chicago';
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const weekEnd = addDays(today, 6);
  const fmt = (iso, o) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', ...o });
  const esc = (v) => { const n = document.createElement('span'); n.textContent = v == null ? '' : String(v); return n.innerHTML; };

  // ---- Categories (from words in the title/details) ----
  const CATS = [
    { id: 'noschool', label: 'No school', color: '#ff7a7a', test: /^(?!.*(return|grade)).*(\bbreak\b|school closed|institute day|records day|no students|not students|not in attendance)/i },
    { id: 'seniors', label: 'Seniors', color: '#ffd700', test: /senior|graduation|cap\s*&\s*gown|prom\b/i },
    { id: 'tests', label: 'Tests & finals', color: '#7ab8ff', test: /exam|finals?\b|\bact\b|pre-\s*act|asvab|testing|\bap\b|advance placement/i },
    { id: 'arts', label: 'Arts & concerts', color: '#d68bff', test: /concert|musical|\bplay\b|madrigal|jazz|choir|orchestra|band\b|solo\s*&\s*ensemble|music|talent show|theat/i },
    { id: 'sports', label: 'Sports', color: '#3fd48a', test: /basketball|wrestling|volleyball|track|bowling|swim|sports|tournament|\bgame\b|scramble/i },
    { id: 'schedule', label: 'Schedule', color: '#b8a9c9', test: /late start|end of .*quarter|students return|last day|panorama/i },
  ];
  const OTHER = { id: 'school', label: 'School', color: '#9e8fb2' };
  const tagsFor = (title, details) => {
    const t = `${title} ${details}`;
    const hit = CATS.filter((c) => c.test.test(t));
    return hit.length ? hit : [OTHER];
  };

  // ---- Times written in details, e.g. "7:00 PM", "10 AM", "10:00 AM to 2:00 PM" ----
  const timeRe = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi;
  const timesIn = (s) => [...String(s).matchAll(timeRe)].map((m) => ((+m[1] % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + (+(m[2] || 0)));

  const events = schoolCalendar.map((r, i) => {
    const [start, title, url, details = '', end] = r;
    const id = (String(url).split('#')[1] || '').replace(/[^A-Za-z0-9_-]/g, '') || 'ev-' + i;
    // Official titles are sometimes in ALL CAPS ("WINTER BREAK"); show them in normal capitalization.
    let nice = String(title).replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
    if (/[A-Z]{3}/.test(nice) && nice === nice.toUpperCase()) nice = nice.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
    nice = nice.replace(/\b(NOT|NO) STUDENTS IN ATTENDANCE\b/gi, (m) => m.charAt(0) + m.slice(1).toLowerCase());
    return { i, start, end: end && end > start ? end : start, title: nice, details: String(details).trim(), id, tags: tagsFor(title, details), times: timesIn(details) };
  }).sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));

  // ---- Add to calendar ----
  const ymd = (iso) => iso.replace(/-/g, '');
  const hm = (min) => String(Math.floor(min / 60)).padStart(2, '0') + String(min % 60).padStart(2, '0') + '00';
  const calRange = (e) => {
    if (e.times.length && e.start === e.end) {
      const s = e.times[0];
      const f = e.times[1] > s ? e.times[1] : Math.min(s + 90, 23 * 60 + 59);
      return { timed: true, s: `${ymd(e.start)}T${hm(s)}`, f: `${ymd(e.start)}T${hm(f)}` };
    }
    return { timed: false, s: ymd(e.start), f: ymd(addDays(e.end, 1)) };
  };
  const googleUrl = (e) => {
    const r = calRange(e);
    const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${r.s}/${r.f}`, details: [e.details, 'From the WHS Class of 2027 site: https://whs27.com/events/#' + e.id].filter(Boolean).join('\n\n') });
    if (r.timed) p.set('ctz', TZ);
    return 'https://calendar.google.com/calendar/render?' + p;
  };
  const icsText = (e) => {
    const r = calRange(e);
    const clean = (s) => String(s).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WHS27//Class of 2027//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:${e.id}-${e.start}@whs27.com`, `DTSTAMP:${stamp}`,
      r.timed ? `DTSTART;TZID=${TZ}:${r.s}` : `DTSTART;VALUE=DATE:${r.s}`,
      r.timed ? `DTEND;TZID=${TZ}:${r.f}` : `DTEND;VALUE=DATE:${r.f}`,
      `SUMMARY:${clean(e.title)}`, e.details ? `DESCRIPTION:${clean(e.details)}` : '', `URL:https://whs27.com/events/#${e.id}`,
      'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  };
  const CAL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M12 13v5M9.5 15.5h5"/></svg>';

  // ---- UI ----
  const state = { filter: 'all', q: '', showAll: false };
  const filters = [{ id: 'all', label: 'All' }, ...CATS.filter((c) => c.id !== 'schedule')];
  box.innerHTML = `
    <div class="tl-tools">
      <label class="tl-search"><span class="sr-only">Search events</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        <input type="search" id="tl-q" placeholder="Search events, like “prom” or “finals”" autocomplete="off"></label>
      <div class="tl-filters" role="group" aria-label="Show">${filters.map((f) => `<button type="button" data-f="${f.id}" aria-pressed="${f.id === 'all'}">${f.color ? `<i style="background:${f.color}"></i>` : ''}${f.label}</button>`).join('')}</div>
      <p class="tl-count" id="tl-count" aria-live="polite"></p>
    </div>
    <div id="tl-list"></div>`;
  const list = box.querySelector('#tl-list');
  const count = box.querySelector('#tl-count');

  const visible = () => {
    const q = state.q.trim().toLowerCase();
    return events.filter((e) => (state.showAll || e.end >= today || e.id === targetId)
      && (state.filter === 'all' || e.tags.some((t) => t.id === state.filter))
      && (!q || `${e.title} ${e.details} ${e.tags.map((t) => t.label).join(' ')}`.toLowerCase().includes(q)));
  };

  const item = (e) => {
    const isToday = e.start <= today && e.end >= today;
    const thisWeek = !isToday && e.start > today && e.start <= weekEnd;
    const range = e.end !== e.start ? `${fmt(e.start, { month: 'short', day: 'numeric' })} – ${fmt(e.end, { month: 'short', day: 'numeric' })}` : fmt(e.start, { weekday: 'long' });
    return `<li class="tl-item${isToday ? ' is-today' : ''}${e.end < today ? ' is-past' : ''}" id="${esc(e.id)}">
      <div class="tl-date" aria-hidden="true"><b>${fmt(e.start, { day: 'numeric' })}</b><small>${fmt(e.start, { weekday: 'short' })}</small></div>
      <div class="tl-body">
        <h4 class="tl-title">${esc(e.title)}</h4>
        <p class="tl-meta">${isToday ? '<span class="tl-when-badge">Today</span>' : thisWeek ? '<span class="tl-when-badge week">This week</span>' : ''}
          <time datetime="${e.start}">${range}</time>${e.details ? `<span>· ${esc(e.details)}</span>` : ''}
          ${e.tags.map((t) => `<span class="tl-tag" style="--c:${t.color}">${t.label}</span>`).join('')}</p>
      </div>
      <div class="tl-cal-wrap">
        <button type="button" class="tl-cal" aria-haspopup="true" aria-expanded="false" aria-label="Add ${esc(e.title)} to my calendar" data-cal="${e.i}">${CAL_ICON}</button>
        <div class="tl-menu" hidden><p>Add to my calendar</p>
          <a href="#" data-ics="${e.i}">Apple / iPhone / Outlook</a>
          <a href="${esc(googleUrl(e))}" target="_blank" rel="noopener">Google Calendar</a></div>
      </div>
    </li>`;
  };

  let targetId = decodeURIComponent(location.hash.slice(1));
  const render = () => {
    const rows = visible();
    const months = new Map();
    for (const e of rows) { const k = e.start.slice(0, 7); if (!months.has(k)) months.set(k, []); months.get(k).push(e); }
    const pastCount = events.filter((e) => e.end < today).length;
    count.textContent = `${rows.length} event${rows.length === 1 ? '' : 's'}${state.filter !== 'all' || state.q ? ' match' : ' coming up'}`;
    list.innerHTML = rows.length
      ? [...months].map(([k, es]) => `<section class="tl-month" aria-label="${fmt(k + '-15', { month: 'long', year: 'numeric' })}"><h3>${fmt(k + '-15', { month: 'long', year: 'numeric' })}</h3><ol class="tl-list">${es.map(item).join('')}</ol></section>`).join('')
      : `<p class="tl-empty">No events match. Try a different word or filter.</p>`;
    if (pastCount) list.insertAdjacentHTML('beforeend', `<button type="button" class="tl-more" id="tl-past">${state.showAll ? 'Hide past events' : `Show ${pastCount} past event${pastCount === 1 ? '' : 's'}`}</button>`);
  };

  box.addEventListener('click', (ev) => {
    const f = ev.target.closest('[data-f]');
    if (f) { state.filter = f.dataset.f; box.querySelectorAll('[data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b === f))); render(); return; }
    if (ev.target.closest('#tl-past')) { state.showAll = !state.showAll; render(); return; }
    const cal = ev.target.closest('[data-cal]');
    if (cal) {
      const menu = cal.nextElementSibling;
      const open = menu.hidden;
      closeMenus();
      menu.hidden = !open;
      cal.setAttribute('aria-expanded', String(open));
      if (open) menu.querySelector('a').focus();
      ev.stopPropagation();
      return;
    }
    const ics = ev.target.closest('[data-ics]');
    if (ics) {
      ev.preventDefault();
      const e = events.find((x) => String(x.i) === ics.dataset.ics);
      const url = URL.createObjectURL(new Blob([icsText(e)], { type: 'text/calendar' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = e.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) + '.ics';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      closeMenus();
    }
  });
  const closeMenus = () => box.querySelectorAll('.tl-menu').forEach((m) => { m.hidden = true; m.previousElementSibling.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('click', (ev) => { if (!ev.target.closest('.tl-cal-wrap')) closeMenus(); });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    const open = box.querySelector('.tl-menu:not([hidden])');
    if (open) { closeMenus(); open.previousElementSibling.focus(); }
  });
  let timer;
  box.querySelector('#tl-q').addEventListener('input', (ev) => { clearTimeout(timer); timer = setTimeout(() => { state.q = ev.target.value; render(); }, 120); });

  const reveal = () => {
    targetId = decodeURIComponent(location.hash.slice(1));
    if (!targetId) return;
    if (!document.getElementById(targetId)) { state.filter = 'all'; state.q = ''; render(); }
    const el = document.getElementById(targetId);
    if (!el || !el.classList.contains('tl-item')) return;
    box.querySelectorAll('.is-target').forEach((x) => x.classList.remove('is-target'));
    el.classList.add('is-target');
    requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }));
  };
  addEventListener('hashchange', reveal);

  // Keep sticky month labels just under the site header, whatever its height.
  const header = document.querySelector('body > header');
  const setTop = () => box.style.setProperty('--tl-top', (header ? header.getBoundingClientRect().height : 64) + 'px');
  setTop();
  addEventListener('resize', setTop);

  render();
  if (fallback) fallback.remove();
  reveal();
})();
