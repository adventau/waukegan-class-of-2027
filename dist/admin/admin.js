// WHS2027 admin page. Talks to /api/admin/* (signed-in only).
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => { const n = document.createElement('span'); n.textContent = v == null ? '' : String(v); return n.innerHTML; };
const panel = $('#panel');
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }) : '');
const day = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const todayISO = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Chicago' }).format(new Date());
const rid = () => Math.random().toString(36).slice(2, 10);

async function call(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, { method, headers: { 'x-whs-admin': '1', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { location.reload(); throw new Error('Signed out'); }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || 'Something went wrong.');
  return out;
}
let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 2600);
}
const fail = (e) => toast(e.message || 'Something went wrong.', true);

const TYPES = { photo: 'Photo', contact: 'Message', spotlight: 'Nomination', directory: 'Directory sign-up', announcement: 'Announcement request', newsletter: 'Email sign-up' };
const FIELD = {
  name: 'Name', email: 'Email', caption: 'Caption', credit: 'Photo credit', event_slug: 'Event', event_other: 'Event (typed in)', allow_download: 'Downloads allowed', permission: 'Has permission',
  nominee_name: 'Nominee', activities: 'Activities', why: 'Why them', nominator_name: 'Nominated by', path_type: 'Path', future_plans: 'Plans', memory: 'Memory', quote: 'Quote',
  consent: 'Agreed to be listed', organization: 'Club / team', title: 'Headline', details: 'Details', requested_date: 'Post by', link: 'Link', topic: 'Topic', message: 'Message', categories: 'Wants',
};
const EVENT_NAMES = { 'first-day-of-senior-year': 'First Day of Senior Year', 'football-senior-night-2026': 'Football Senior Night', 'parent-teacher-conferences-fall-2026': 'Parent-Teacher Conferences',
  'basketball-season-2026-27': 'Basketball Season', 'winter-break-2026': 'Winter Break', 'spring-break-2027': 'Spring Break', 'last-day-of-classes-2027': 'Last Day of Classes',
  'graduation-2027': 'Graduation', 'homecoming-2026': 'Homecoming', 'prom-2027': 'Prom', other: 'Other' };
const fieldList = (raw) => {
  const data = { ...raw };
  if (data.event_slug) data.event_slug = EVENT_NAMES[data.event_slug] || data.event_slug;
  return fieldListRaw(data);
};
const fieldListRaw = (data) => '<dl class="fields">' + Object.entries(data).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length))
  .map(([k, v]) => `<dt>${esc(FIELD[k] || k)}</dt><dd>${k === 'email' ? `<a href="mailto:${esc(v)}">${esc(v)}</a>` : k === 'link' ? `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(v)}</a>` : esc(typeof v === 'boolean' ? (v ? 'Yes' : 'No') : Array.isArray(v) ? v.join(', ') : v)}</dd>`).join('') + '</dl>';

// ---------------- Router ----------------
const views = {};
function show() {
  const tab = (location.hash.slice(1) || 'overview').split('/')[0];
  $$('.tabs a').forEach((a) => (a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  panel.innerHTML = '<p class="muted">Loading…</p>';
  (views[tab] || views.overview)().catch(fail);
}
addEventListener('hashchange', show);
$('#logout').addEventListener('click', async () => { await call('/api/admin/logout', { method: 'POST' }).catch(() => {}); location.replace('/admin/'); });

async function refreshCounts() {
  const o = await call('/api/admin/overview');
  const n = (type, statuses) => o.counts.filter((c) => (!type || c.type === type) && statuses.includes(c.status)).reduce((a, c) => a + c.n, 0);
  $('[data-count="photo"]').textContent = n('photo', ['pending']) || '';
  $('[data-count="inbox"]').textContent = o.counts.filter((c) => c.type !== 'photo' && ['pending', 'new'].includes(c.status)).reduce((a, c) => a + c.n, 0) || '';
  $('[data-count="errors"]').textContent = o.errors24h || '';
  return { o, n };
}

// ---------------- Overview ----------------
views.overview = async () => {
  const { o, n } = await refreshCounts();
  const allOk = Object.values(o.checks).every((c) => c.ok);
  panel.innerHTML = `<h1>Overview</h1>
  <div class="grid g4" style="margin:16px 0">
    <a class="card stat" href="#photos" style="text-decoration:none;color:inherit"><b>${n('photo', ['pending'])}</b>Photos to review</a>
    <a class="card stat" href="#inbox" style="text-decoration:none;color:inherit"><b>${o.counts.filter((c) => c.type !== 'photo' && ['pending', 'new'].includes(c.status)).reduce((a, c) => a + c.n, 0)}</b>Inbox · new</a>
    <a class="card stat" href="#visits" style="text-decoration:none;color:inherit"><b>${o.visitsToday}</b>Page views today</a>
    <a class="card stat" href="#errors" style="text-decoration:none;color:inherit"><b>${o.errors24h}</b>Errors · 24h</a>
  </div>
  <div class="card stack">
    <div class="row between"><h2 style="margin:0">System status</h2><span class="pill ${allOk ? 'ok' : 'bad'}">${allOk ? 'All systems operational' : 'Needs attention'}</span></div>
    ${statusRows(o)}
  </div>
  <div class="card stack" style="margin-top:14px">
    <h2 style="margin:0">Shortcuts</h2>
    <div class="row"><a class="btn" href="#switches">Turn things on or off</a><a class="btn" href="#content/news">Write a news post</a><a class="btn" href="#content/events">Edit events</a><a class="btn" href="/" target="_blank" rel="noopener">Open the site ↗</a></div>
  </div>`;
};
function statusRows(o) {
  const row = (label, c, okText, badText) => `<div class="row between"><span>${label}</span><span class="pill ${c.ok ? 'ok' : 'bad'}">${c.ok ? okText : badText}</span></div>`;
  return row('Website', { ok: true }, 'Online', 'Down') +
    row('Database (forms, visits, switches)', o.checks.database, `Working · ${o.checks.database.ms ?? '?'} ms`, 'Not responding') +
    row('Photo storage', o.checks.fileStorage, `Working · ${o.checks.fileStorage.ms ?? '?'} ms`, 'Not responding') +
    row('Admin password', o.checks.adminPassword, 'Set', 'Too short — make it at least 12 characters') +
    `<p class="muted small" style="margin:0">Checked ${when(o.serverTime)}${o.deploy.commit ? ` · Live version ${esc(o.deploy.commit.slice(0, 7))}` : ''}</p>`;
}

// ---------------- Photos ----------------
let photoStatus = 'pending';
views.photos = async () => {
  const { items } = await call('/api/admin/submissions?type=photo&status=' + photoStatus);
  panel.innerHTML = `<div class="row between" style="margin-bottom:14px"><h1 style="margin:0">Photos</h1>
    <div class="seg" role="group" aria-label="Show">${[['pending', 'Waiting'], ['approved', 'On the site'], ['rejected', 'Rejected']].map(([k, l]) => `<button type="button" data-st="${k}" aria-pressed="${k === photoStatus}">${l}</button>`).join('')}</div></div>
    ${photoStatus === 'pending' && items.length > 1 ? `<div class="row" style="margin-bottom:10px"><button class="btn green" id="approve-all">✓ Approve all ${items.length}</button></div>` : ''}
    <p class="muted">${photoStatus === 'pending' ? 'Approve a photo to put it on the Photos page and homepage. Rejecting deletes the file.' : photoStatus === 'approved' ? 'These are live on the site. “Take down” removes the photo and deletes the file.' : 'Rejected photo files are already deleted. Only the form details are kept until you delete them.'}</p>
    ${items.length ? `<div class="grid g2">${items.map(photoCard).join('')}</div>` : `<div class="empty">${photoStatus === 'pending' ? 'No photos waiting for review.' : 'Nothing here yet.'}</div>`}`;
  $$('[data-st]').forEach((b) => b.addEventListener('click', () => { photoStatus = b.dataset.st; views.photos().catch(fail); }));
  $$('[data-act]').forEach((b) => b.addEventListener('click', () => act(b, views.photos)));
  wireCaptions();
  $('#approve-all')?.addEventListener('click', async (e) => {
    if (!confirm(`Approve all ${items.length} photos? They'll all go on the site.`)) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    let done = 0;
    for (const it of items) {
      btn.textContent = `Approving ${done + 1} of ${items.length}…`;
      try { await call('/api/admin/submissions/' + it.id, { method: 'POST', body: { action: 'approve' } }); done++; } catch (err) { fail(err); break; }
    }
    toast(`Approved ${done} photo${done === 1 ? '' : 's'}`);
    views.photos().catch(fail);
  });
  refreshCounts().catch(() => {});
};
function photoCard(it) {
  const img = !it.hasFile ? '<div class="noimg">File deleted</div>'
    : it.file_type === 'image/heic' ? `<div class="noimg">iPhone HEIC photo — <a href="/api/admin/file/${it.id}" target="_blank">download to view</a><br>(browsers can’t show HEIC on the site)</div>`
    : `<a href="/api/admin/file/${it.id}" target="_blank" rel="noopener"><img src="/api/admin/file/${it.id}" alt="${esc(it.data.caption || 'Submitted photo')}" loading="lazy"></a>`;
  const btns = it.status === 'pending'
    ? `<button class="btn green" data-act="approve" data-id="${it.id}">✓ Approve</button><button class="btn red" data-act="reject" data-id="${it.id}" data-confirm="Reject this photo? The file will be deleted.">Reject</button>`
    : it.status === 'approved'
      ? `<button class="btn red" data-act="reject" data-id="${it.id}" data-confirm="Take this photo down? It will disappear from the site and the file will be deleted.">Take down</button>`
      : `<button class="btn red" data-act="delete" data-id="${it.id}" data-confirm="Delete this record for good?">Delete record</button>`;
  const { caption = '', ...rest } = it.data;
  return `<article class="card photo-card" data-photo-id="${it.id}">${img}<div class="body"><span class="muted small">Sent ${when(it.created_at)}</span>
    <div class="caption-box">
      <div class="caption-view"><div class="row between" style="align-items:flex-start;gap:12px"><div style="min-width:0"><span class="cap-label">Caption</span>
        <p class="cap-text">${caption ? esc(caption) : '<span class="muted">No caption</span>'}</p></div>
        <button class="btn" type="button" data-edit-caption="${it.id}">✎ Edit</button></div></div>
      <form class="caption-edit" hidden><label for="cap-${it.id}">Caption</label>
        <textarea id="cap-${it.id}" maxlength="500" rows="3">${esc(caption)}</textarea>
        <div class="row between" style="margin-top:8px"><span class="muted small"><span data-left>${500 - caption.length}</span> characters left · also used as alt text</span>
        <div class="row"><button class="btn" type="button" data-cancel-caption>Cancel</button><button class="btn gold" type="submit">Save caption</button></div></div></form>
    </div>
    ${fieldList(rest)}<div class="row">${btns}</div></div></article>`;
}
// Edit a caption in place, without reloading the list.
function wireCaptions() {
  $$('.photo-card').forEach((card) => {
    const view = $('.caption-view', card);
    const form = $('.caption-edit', card);
    if (!view || !form) return;
    const area = $('textarea', form);
    const left = $('[data-left]', form);
    const open = (on) => { view.hidden = on; form.hidden = !on; if (on) { area.focus(); area.setSelectionRange(area.value.length, area.value.length); } };
    $('[data-edit-caption]', card).addEventListener('click', () => open(true));
    $('[data-cancel-caption]', card).addEventListener('click', () => { area.value = area.defaultValue; left.textContent = 500 - area.value.length; open(false); });
    area.addEventListener('input', () => { left.textContent = 500 - area.value.length; });
    area.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('[data-cancel-caption]', card).click(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      try {
        const out = await call('/api/admin/submissions/' + card.dataset.photoId, { method: 'POST', body: { action: 'caption', caption: area.value } });
        area.defaultValue = out.caption;
        $('.cap-text', card).innerHTML = out.caption ? esc(out.caption) : '<span class="muted">No caption</span>';
        const img = $('img', card);
        if (img) img.alt = out.caption || 'Submitted photo';
        open(false);
        toast('Caption saved');
      } catch (err) { fail(err); }
      btn.disabled = false;
    });
  });
}
async function act(btn, reload) {
  if (btn.dataset.confirm && !confirm(btn.dataset.confirm)) return;
  btn.disabled = true;
  try {
    await call('/api/admin/submissions/' + btn.dataset.id, { method: 'POST', body: { action: btn.dataset.act } });
    toast({ approve: 'Approved — it’s live', reject: 'Done', delete: 'Deleted', done: 'Marked done', reopen: 'Moved back' }[btn.dataset.act] || 'Saved');
    await reload();
  } catch (e) { fail(e); btn.disabled = false; }
}

// ---------------- Inbox ----------------
let inboxType = 'contact';
let inboxOpen = true;
views.inbox = async () => {
  const kinds = ['contact', 'spotlight', 'directory', 'announcement', 'newsletter'];
  const { items } = await call('/api/admin/submissions?type=' + inboxType);
  const open = items.filter((i) => ['pending', 'new'].includes(i.status));
  const shown = inboxOpen ? open : items.filter((i) => !['pending', 'new'].includes(i.status));
  const review = !['contact', 'newsletter'].includes(inboxType);
  panel.innerHTML = `<h1>Inbox</h1>
    <div class="row between" style="margin-bottom:14px">
      <div class="seg" role="group" aria-label="Type">${kinds.map((k) => `<button type="button" data-k="${k}" aria-pressed="${k === inboxType}">${{ contact: 'Messages', spotlight: 'Nominations', directory: 'Directory', announcement: 'Announcement requests', newsletter: 'Email sign-ups' }[k]}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Show"><button type="button" data-o="1" aria-pressed="${inboxOpen}">New (${open.length})</button><button type="button" data-o="0" aria-pressed="${!inboxOpen}">Handled</button></div>
    </div>
    ${inboxType === 'directory' ? '<p class="muted">Approving keeps a list of who is OK to show. The site does not have a public directory page yet.</p>' : ''}
    ${inboxType === 'announcement' ? '<p class="muted">Approving marks it handled. To post it, write it up under <a href="#content/news">Content → News</a>.</p>' : ''}
    ${shown.length ? `<div class="grid g2">${shown.map((it) => `<article class="card"><div class="row between"><span class="pill ${it.status === 'approved' || it.status === 'done' ? 'ok' : it.status === 'rejected' ? 'bad' : 'gold'}">${esc(it.status)}</span><span class="muted small">${when(it.created_at)}</span></div>
      ${fieldList(it.data)}${it.hasFile ? `<p><a href="/api/admin/file/${it.id}" target="_blank" rel="noopener">View attached photo ↗</a></p>` : ''}
      <div class="row">${['pending', 'new'].includes(it.status)
        ? (review ? `<button class="btn green" data-act="approve" data-id="${it.id}">✓ Approve</button><button class="btn" data-act="reject" data-id="${it.id}">Reject</button>` : `<button class="btn green" data-act="done" data-id="${it.id}">✓ Mark done</button>`)
        : `<button class="btn" data-act="reopen" data-id="${it.id}">Move back to New</button>`}
        ${it.type === 'contact' ? `<a class="btn" href="mailto:${esc(it.data.email)}?subject=${encodeURIComponent('Re: your message to WHS2027')}">Reply by email</a>` : ''}
        <button class="btn red" data-act="delete" data-id="${it.id}" data-confirm="Delete this for good?">Delete</button></div></article>`).join('')}</div>` : '<div class="empty">Nothing here.</div>'}`;
  $$('[data-k]').forEach((b) => b.addEventListener('click', () => { inboxType = b.dataset.k; views.inbox().catch(fail); }));
  $$('[data-o]').forEach((b) => b.addEventListener('click', () => { inboxOpen = b.dataset.o === '1'; views.inbox().catch(fail); }));
  $$('[data-act]').forEach((b) => b.addEventListener('click', () => act(b, views.inbox)));
  refreshCounts().catch(() => {});
};

// ---------------- Visits ----------------
let visitDays = 30;
views.visits = async () => {
  const v = await call('/api/admin/visits?days=' + visitDays);
  const map = Object.fromEntries(v.daily.map((d) => [d.day, d.n]));
  const days = [];
  for (let i = v.days - 1; i >= 0; i--) days.push(new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Chicago' }).format(new Date(Date.now() - i * 86400000)));
  const max = Math.max(1, ...days.map((d) => map[d] || 0));
  const total = days.reduce((a, d) => a + (map[d] || 0), 0);
  const topMax = Math.max(1, ...v.pages.map((p) => p.n));
  panel.innerHTML = `<div class="row between" style="margin-bottom:14px"><h1 style="margin:0">Traffic</h1>
    <div class="seg" role="group" aria-label="Range">${[7, 30, 90].map((d) => `<button type="button" data-d="${d}" aria-pressed="${d === visitDays}">${d} days</button>`).join('')}</div></div>
    <div class="card"><div class="row between"><h2 style="margin:0">${total.toLocaleString()} page visits</h2><span class="muted small">last ${v.days} days</span></div>
    <div class="chart" role="img" aria-label="Visits per day">${days.map((d) => `<div style="height:${Math.max(2, ((map[d] || 0) / max) * 100)}%" data-tip="${day(d)}: ${map[d] || 0}"></div>`).join('')}</div>
    <div class="row between muted small"><span>${day(days[0])}</span><span>${day(days[days.length - 1])}</span></div></div>
    <div class="card" style="margin-top:14px"><h2>Most visited pages</h2>${v.pages.length ? v.pages.map((p) => `<div class="bar-row"><div><a href="${esc(p.path)}" target="_blank" rel="noopener">${esc(p.path)}</a><div class="bar" style="width:${(p.n / topMax) * 100}%"></div></div><b>${p.n}</b></div>`).join('') : '<p class="muted">No visits yet.</p>'}</div>
    <p class="muted small">Counts are anonymous: just a page and a number per day. Visitors whose browser says “Do Not Track” aren’t counted.</p>`;
  $$('[data-d]').forEach((b) => b.addEventListener('click', () => { visitDays = Number(b.dataset.d); views.visits().catch(fail); }));
};

// ---------------- Switches ----------------
views.switches = async () => {
  const s = await call('/api/admin/settings');
  const sw = (id, label, help, on) => `<label class="switch" for="${id}"><span><b>${label}</b><br><span class="muted small">${help}</span></span><input type="checkbox" id="${id}" ${on ? 'checked' : ''}></label>`;
  panel.innerHTML = `<h1>Switches</h1><p class="muted">Flip a switch, then press <b>Save</b>. Changes show up on the site within a minute.</p>
  <form id="swf" class="stack">
    <div class="card"><h2>Announcement banner</h2>
      ${sw('banner', 'Show a banner at the top of every page', 'A gold strip under the menu, for big news like “Prom tickets on sale”.', s.banner)}
      <div class="grid g2" style="margin-top:10px"><div><label for="bannerText">Banner text</label><input id="bannerText" maxlength="200" value="${esc(s.bannerText)}" placeholder="Prom tickets go on sale Monday!"></div>
      <div><label for="bannerLink">Banner link (optional)</label><input id="bannerLink" value="${esc(s.bannerLink)}" placeholder="/announcements or https://…"></div></div></div>
    <div class="card"><h2>Homepage</h2>
      ${sw('welcome', 'Welcome popup', 'The “Welcome, Class of 2027” box first-time visitors see.', s.welcome)}
      ${sw('sec-countdown', 'School break countdown', '', s.sections.countdown)}
      ${sw('sec-events', 'Upcoming School Events', '', s.sections.events)}
      ${sw('sec-photos', 'From the class (photos)', '', s.sections.photos)}
      ${sw('sec-spotlight', 'Senior spotlight', '', s.sections.spotlight)}</div>
    <div class="card"><h2>Forms people can send</h2><p class="muted small" style="margin:0">Turn one off to close it. Visitors see “This form is closed right now.”</p>
      ${sw('f-photo', 'Submit a photo', '', s.forms.photo)}${sw('f-contact', 'Contact us', '', s.forms.contact)}${sw('f-spotlight', 'Nominate a senior', '', s.forms.spotlight)}
      ${sw('f-directory', 'Join the directory', '', s.forms.directory)}${sw('f-announcement', 'Request an announcement', '', s.forms.announcement)}${sw('f-newsletter', 'Email sign-up (news page)', '', s.forms.newsletter)}</div>
    <div class="row"><button class="btn gold" type="submit">Save switches</button></div>
  </form>`;
  $('#swf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const c = (id) => $('#' + id).checked;
    if (c('banner') && !$('#bannerText').value.trim()) return toast('Type some banner text first.', true);
    try {
      await call('/api/admin/settings', { method: 'PUT', body: {
        welcome: c('welcome'), banner: c('banner'), bannerText: $('#bannerText').value.trim(), bannerLink: $('#bannerLink').value.trim(),
        sections: { countdown: c('sec-countdown'), events: c('sec-events'), photos: c('sec-photos'), spotlight: c('sec-spotlight') },
        forms: { photo: c('f-photo'), contact: c('f-contact'), spotlight: c('f-spotlight'), directory: c('f-directory'), announcement: c('f-announcement'), newsletter: c('f-newsletter') },
      } });
      toast('Saved ✓');
    } catch (err) { fail(err); }
  });
};

// ---------------- Content ----------------
async function original(file, expr) {
  const text = await fetch(file + '?original', { cache: 'no-store' }).then((r) => r.text());
  return new Function(text + '\n;return ' + expr)();
}
async function current(key, file, expr) {
  const { value } = await call('/api/admin/content/' + key);
  return { value: value ?? (await original(file, expr)), edited: value != null };
}
views.content = async () => {
  const sub = location.hash.split('/')[1] || 'news';
  panel.innerHTML = `<h1>Content</h1><div class="seg" role="group" aria-label="What to edit" style="margin-bottom:16px">
    ${[['news', 'News posts'], ['events', 'Events'], ['games', 'Game schedules'], ['breaks', 'School breaks']].map(([k, l]) => `<button type="button" data-sub="${k}" aria-pressed="${k === sub}">${l}</button>`).join('')}</div><div id="sub"><p class="muted">Loading…</p></div>`;
  $$('[data-sub]').forEach((b) => b.addEventListener('click', () => { location.hash = 'content/' + b.dataset.sub; }));
  await ({ news, events, games, breaks }[sub] || news)($('#sub'));
};

const CATS = ['Important', 'Events', 'Graduation', 'Scholarships', 'College', 'School Schedule', 'Reminders'];
async function news(box, editing = null) {
  const { items } = await call('/api/admin/posts');
  const p = editing || { title: '', category: 'Reminders', summary: '', body: '', pinned: 0, published: 1 };
  box.innerHTML = `<div class="card stack"><h2 style="margin:0">${editing ? 'Edit post' : 'Write a new post'}</h2>
    <form id="pf" class="stack">
      <div><label for="pt">Headline</label><input id="pt" required maxlength="160" value="${esc(p.title)}"></div>
      <div class="grid g2"><div><label for="pc">Category</label><select id="pc">${CATS.map((c) => `<option ${c === p.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div><label for="ps">Short summary (shows on the news page)</label><input id="ps" maxlength="300" value="${esc(p.summary)}"></div></div>
      <div><label for="pb">The post</label><textarea id="pb" required placeholder="Write it here. Leave a blank line between paragraphs.">${esc(p.body)}</textarea></div>
      <label class="switch" for="pp"><span><b>Pin to the top</b></span><input type="checkbox" id="pp" ${p.pinned ? 'checked' : ''}></label>
      <label class="switch" for="pv"><span><b>Visible on the site</b><br><span class="muted small">Turn off to save it as a draft.</span></span><input type="checkbox" id="pv" ${p.published ? 'checked' : ''}></label>
      <div class="row"><button class="btn gold" type="submit">${editing ? 'Save changes' : 'Publish'}</button>${editing ? '<button class="btn" type="button" id="pcancel">Cancel</button>' : ''}</div>
    </form></div>
    <div class="card" style="margin-top:14px"><h2>Your posts</h2>${items.length ? items.map((it) => `<div class="row between" style="padding:10px 0;border-bottom:1px solid var(--line)"><div><b>${esc(it.title)}</b><br><span class="muted small">${esc(it.category)} · ${when(it.created_at)}${it.pinned ? ' · 📌 pinned' : ''}${it.published ? '' : ' · draft'}</span></div>
      <div class="row"><a class="btn" href="/announcements/post/?id=${it.id}" target="_blank" rel="noopener">View</a><button class="btn" data-edit="${it.id}">Edit</button><button class="btn red" data-del="${it.id}">Delete</button></div></div>`).join('') : '<p class="muted">No posts yet. The four original stories on the news page stay as they are.</p>'}</div>`;
  $('#pf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { title: $('#pt').value, category: $('#pc').value, summary: $('#ps').value, body: $('#pb').value, pinned: $('#pp').checked, published: $('#pv').checked };
    try {
      await call('/api/admin/posts' + (editing ? '/' + editing.id : ''), { method: editing ? 'PUT' : 'POST', body });
      toast(editing ? 'Saved ✓' : 'Published ✓');
      await news(box);
    } catch (err) { fail(err); }
  });
  $('#pcancel')?.addEventListener('click', () => news(box));
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => news(box, items.find((i) => i.id === b.dataset.edit)).then(() => box.scrollIntoView())));
  $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this post for good?')) return;
    try { await call('/api/admin/posts/' + b.dataset.del, { method: 'DELETE' }); toast('Deleted'); await news(box); } catch (err) { fail(err); }
  }));
}

// A small spreadsheet-style editor used for events, games and breaks.
function rowEditor(box, { title, help, cols, rows, edited, onSave, onReset, newRow, isPast }) {
  let hidePast = true;
  let filter = '';
  const draw = () => {
    const today = todayISO();
    const visible = rows.map((r, i) => [r, i]).filter(([r]) => (!hidePast || !isPast?.(r, today)) && (!filter || r.join(' ').toLowerCase().includes(filter)));
    $('#rows', box).innerHTML = visible.map(([r, i]) => `<tr>${cols.map((c) => `<td><input aria-label="${c.label}" data-i="${i}" data-c="${c.at}" type="${c.type || 'text'}" value="${esc(r[c.at] ?? '')}" ${c.required ? 'required' : ''} style="${c.width ? 'min-width:' + c.width : ''}"></td>`).join('')}<td><button class="btn red" type="button" data-rm="${i}" aria-label="Delete row">✕</button></td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="muted" style="padding:14px">Nothing to show.</td></tr>`;
    $$('[data-i]', box).forEach((inp) => inp.addEventListener('input', () => { rows[inp.dataset.i][inp.dataset.c] = inp.value; }));
    $$('[data-rm]', box).forEach((b) => b.addEventListener('click', () => { rows.splice(Number(b.dataset.rm), 1); draw(); }));
  };
  box.innerHTML = `<div class="card stack"><div class="row between"><h2 style="margin:0">${title}</h2>${edited ? '<span class="pill gold">You’ve edited this</span>' : '<span class="pill">Original</span>'}</div>
    <p class="muted" style="margin:0">${help}</p>
    <div class="row"><button class="btn" type="button" id="add">+ Add</button>${isPast ? '<label class="row" style="font-weight:600"><input type="checkbox" id="hp" checked style="width:auto;min-height:0"> Hide past dates</label>' : ''}<input type="search" id="flt" placeholder="Search…" style="max-width:220px"></div>
    <div class="table-wrap"><table class="edit"><thead><tr>${cols.map((c) => `<th>${c.label}</th>`).join('')}<th></th></tr></thead><tbody id="rows"></tbody></table></div>
    <div class="row"><button class="btn gold" type="button" id="save">Save</button>${edited ? '<button class="btn red" type="button" id="reset">Undo all my edits</button>' : ''}<span class="muted small">Shows on the site within a minute of saving.</span></div></div>`;
  draw();
  $('#add', box).addEventListener('click', () => { rows.unshift(newRow()); hidePast = false; if ($('#hp', box)) $('#hp', box).checked = false; filter = ''; $('#flt', box).value = ''; draw(); $('#rows input', box)?.focus(); });
  $('#hp', box)?.addEventListener('change', (e) => { hidePast = e.target.checked; draw(); });
  $('#flt', box).addEventListener('input', (e) => { filter = e.target.value.toLowerCase(); draw(); });
  $('#save', box).addEventListener('click', async () => { try { await onSave(rows); toast('Saved ✓'); } catch (err) { fail(err); } });
  $('#reset', box)?.addEventListener('click', async () => {
    if (!confirm('Go back to the original list? Your edits here will be lost.')) return;
    try { await onReset(); toast('Back to the original'); } catch (err) { fail(err); }
  });
}

async function events(box) {
  const { value, edited } = await current('calendar', '/school-calendar.js', 'schoolCalendar');
  const rows = value.map((r) => [...r]);
  rowEditor(box, {
    title: 'School events', edited, rows,
    help: 'These show on the Events page and in “Upcoming School Events” on the homepage. Leave “End” the same as “Start” for one-day events.',
    cols: [{ at: 0, label: 'Start', type: 'date', required: true }, { at: 4, label: 'End', type: 'date' }, { at: 1, label: 'Title', required: true, width: '240px' }, { at: 3, label: 'Details (time, place…)', width: '200px' }],
    isPast: (r, t) => (r[4] || r[0]) < t,
    newRow: () => { const id = 'whs-n' + rid(); const d = todayISO(); return [d, '', '/events/#' + id, '', d]; },
    onSave: (rs) => call('/api/admin/content/calendar', { method: 'PUT', body: { value: rs.map((r) => [r[0], r[1].trim(), r[2], (r[3] || '').trim(), r[4] || r[0]]) } }).then(() => events(box)),
    onReset: () => call('/api/admin/content/calendar', { method: 'DELETE' }).then(() => events(box)),
  });
}

let gameLevel = 'teamFixtures';
let gameTeam = null;
async function games(box) {
  const { value, edited } = await current('fixtures', '/sports-data.js', '({ teamFixtures, jvFixtures })');
  const data = JSON.parse(JSON.stringify(value));
  const sportsHtml = await fetch('/sports/').then((r) => r.text()).catch(() => '');
  const teams = [...new Set([...sportsHtml.matchAll(/data-team="([^"]+)"/g)].map((m) => m[1]).concat(Object.keys(data.teamFixtures), Object.keys(data.jvFixtures)))];
  gameTeam ||= teams[0];
  data[gameLevel][gameTeam] ||= [];
  const rows = data[gameLevel][gameTeam];
  box.innerHTML = `<div class="row" style="margin-bottom:12px"><div class="seg" role="group" aria-label="Level"><button type="button" data-lv="teamFixtures" aria-pressed="${gameLevel === 'teamFixtures'}">Varsity</button><button type="button" data-lv="jvFixtures" aria-pressed="${gameLevel === 'jvFixtures'}">JV</button></div>
    <label for="team" class="sr-only">Team</label><select id="team" style="max-width:260px">${teams.map((t) => `<option value="${esc(t)}" ${t === gameTeam ? 'selected' : ''}>${esc(t.replace(/-/g, ' '))}</option>`).join('')}</select></div><div id="ge"></div>`;
  $$('[data-lv]', box).forEach((b) => b.addEventListener('click', () => { gameLevel = b.dataset.lv; games(box).catch(fail); }));
  $('#team', box).addEventListener('change', (e) => { gameTeam = e.target.value; games(box).catch(fail); });
  rowEditor($('#ge', box), {
    title: `${gameLevel === 'jvFixtures' ? 'JV' : 'Varsity'} ${gameTeam.replace(/-/g, ' ')}`, edited, rows,
    help: 'Shows on the Sports page. Varsity games also show on the homepage. Write the time like “7:00 PM CT”. Leave venue empty for “Venue pending”.',
    cols: [{ at: 0, label: 'Date', type: 'date', required: true }, { at: 1, label: 'Matchup', required: true, width: '220px' }, { at: 2, label: 'Time', width: '110px' }, { at: 3, label: 'Venue', width: '180px' }],
    isPast: (r, t) => r[0] < t,
    newRow: () => [todayISO(), 'Bulldogs vs. ', '', '', `game-${(gameLevel === 'jvFixtures' ? 'jv-' : '') + gameTeam}-${rid()}`],
    onSave: (rs) => { data[gameLevel][gameTeam] = rs.map((r) => [r[0], r[1].trim(), (r[2] || '').trim(), (r[3] || '').trim(), r[4]]); return call('/api/admin/content/fixtures', { method: 'PUT', body: { value: data } }).then(() => games(box)); },
    onReset: () => call('/api/admin/content/fixtures', { method: 'DELETE' }).then(() => games(box)),
  });
}

async function breaks(box) {
  const { value, edited } = await current('breaks', '/home-data.js', 'homeBreaks');
  const rows = value.map((r) => [r[0], r[1], r[2] || '', r[3] || '']);
  rowEditor(box, {
    title: 'School breaks', edited, rows,
    help: 'The homepage counts down to the next one. Give a break an end date so it shows “On break” during it. A date with no end (like the last day of classes) is only listed, not counted down to.',
    cols: [{ at: 0, label: 'Starts', type: 'date', required: true }, { at: 3, label: 'Ends', type: 'date' }, { at: 1, label: 'Name', required: true, width: '200px' }, { at: 2, label: 'Link (optional)', width: '200px' }],
    isPast: (r, t) => (r[3] || r[0]) < t,
    newRow: () => [todayISO(), '', '', ''],
    onSave: (rs) => call('/api/admin/content/breaks', { method: 'PUT', body: { value: rs.map((r) => (r[3] ? [r[0], r[1].trim(), r[2].trim(), r[3]] : [r[0], r[1].trim(), r[2].trim()])) } }).then(() => breaks(box)),
    onReset: () => call('/api/admin/content/breaks', { method: 'DELETE' }).then(() => breaks(box)),
  });
}

// ---------------- Status & errors ----------------
views.errors = async () => {
  const [o, { items }] = await Promise.all([call('/api/admin/overview'), call('/api/admin/errors')]);
  panel.innerHTML = `<h1>Status &amp; logs</h1>
    <div class="card stack">${statusRows(o)}</div>
    <div class="card" style="margin-top:14px"><div class="row between"><h2 style="margin:0">Recent errors (${items.length})</h2>${items.length ? '<button class="btn" id="clr">Clear all</button>' : ''}</div>
    <p class="muted small">“Browser” errors happened on a visitor’s phone or computer. “Server” errors happened on the site’s server. A few now and then is normal.</p>
    ${items.length ? items.map((e) => `<div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row between"><span><span class="pill ${e.source === 'server' ? 'bad' : 'gold'}">${esc(e.source)}</span> <b>${esc(e.message)}</b></span><span class="muted small">${when(e.at)}</span></div><p class="muted small" style="margin:4px 0 0">Page: ${esc(e.path || '—')}</p>${e.detail ? `<details><summary class="small">Technical details</summary><pre class="err">${esc(e.detail)}</pre></details>` : ''}</div>`).join('') : '<div class="empty">No errors logged.</div>'}</div>`;
  $('#clr')?.addEventListener('click', async () => { if (!confirm('Clear the error list?')) return; try { await call('/api/admin/errors', { method: 'DELETE' }); toast('Cleared'); views.errors(); } catch (e) { fail(e); } });
  refreshCounts().catch(() => {});
};

show();

// Header clock (Chicago time) and link status.
const clockEl = $('#clock');
const tickClock = () => { clockEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Chicago' }); };
tickClock(); setInterval(tickClock, 1000);
addEventListener('offline', () => { $('#sb-status').innerHTML = 'link <b style="color:var(--red)">offline</b>'; });
addEventListener('online', () => { $('#sb-status').innerHTML = 'link <b>online</b>'; });
