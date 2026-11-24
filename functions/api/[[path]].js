// All /api/* requests. Public routes first, then /api/admin/* (signed-in only; checked in functions/_middleware.js too).
import {
  json, now, newId, chicagoDay, ipKey, isAdmin, checkPassword, makeSessionCookie, clearSessionCookie,
  rateLimited, noteAttempt, getSwitches, putSetting, getSetting, DEFAULT_SWITCHES, logError, MAX_UPLOAD, sniffImage,
} from '../../lib/server.js';
import { FORMS, validate } from '../../lib/forms.js';
import { CONTENT_KEYS } from '../../lib/content.js';

const parse = (s) => { try { return JSON.parse(s); } catch { return {}; } };
const publicPhoto = (r) => {
  const d = parse(r.data);
  return { id: r.id, caption: d.caption || '', credit: d.credit || d.name || '', event: d.event_slug || '', download: !!d.allow_download, date: r.reviewed_at || r.created_at, type: r.file_type };
};

export async function onRequest(context) {
  const { request, env, params } = context;
  const parts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const route = parts.join('/');
  const method = request.method;
  try {
    if (parts[0] === 'admin') return await admin(context, parts.slice(1), method);

    // ---- Public ----
    if (route === 'settings' && method === 'GET') {
      const s = await getSwitches(env);
      return json(s, 200, { 'cache-control': 'public, max-age=30' });
    }

    if (route === 'hit' && method === 'POST') {
      if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return new Response(null, { status: 204 });
      const body = await request.json().catch(() => ({}));
      let path = String(body.path || '/').split('?')[0].split('#')[0].slice(0, 200);
      if (!path.startsWith('/') || path.startsWith('/admin') || path.startsWith('/api')) return new Response(null, { status: 204 });
      if (path.length > 1 && !path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) path += '/';
      await env.DB.prepare('INSERT INTO visits (day, path, count) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET count = count + 1')
        .bind(chicagoDay(), path).run();
      return new Response(null, { status: 204 });
    }

    if (route === 'error' && method === 'POST') {
      const key = await ipKey(request, env);
      if (await rateLimited(env, 'err:' + key, 30, 3600000)) return new Response(null, { status: 204 });
      await noteAttempt(env, 'err:' + key);
      const b = await request.json().catch(() => ({}));
      await logError(env, 'browser', b.page, b.message, [b.source, b.line && 'line ' + b.line, b.stack, request.headers.get('user-agent')].filter(Boolean).join('\n'));
      return new Response(null, { status: 204 });
    }

    if (route === 'photos' && method === 'GET') {
      const rows = await env.DB.prepare("SELECT id, data, created_at, reviewed_at, file_type FROM submissions WHERE type = 'photo' AND status = 'approved' ORDER BY COALESCE(reviewed_at, created_at) DESC LIMIT 500").all();
      return json({ photos: rows.results.map(publicPhoto) }, 200, { 'cache-control': 'public, max-age=30' });
    }

    if (parts[0] === 'photo' && parts[1] && method === 'GET') {
      const row = await env.DB.prepare("SELECT file_key, file_type, data FROM submissions WHERE id = ? AND type = 'photo' AND status = 'approved'").bind(parts[1]).first();
      if (!row?.file_key) return json({ error: 'Not found' }, 404);
      const file = await env.FILES.get(row.file_key, 'arrayBuffer');
      if (!file) return json({ error: 'Not found' }, 404);
      const h = { 'content-type': row.file_type, 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' };
      if (new URL(request.url).searchParams.has('download') && parse(row.data).allow_download) h['content-disposition'] = `attachment; filename="whs2027-${parts[1]}.${row.file_type.split('/')[1]}"`;
      return new Response(file, { headers: h });
    }

    if (route === 'posts' && method === 'GET') {
      const rows = await env.DB.prepare('SELECT id, title, category, summary, body, pinned, created_at, updated_at FROM posts WHERE published = 1 ORDER BY pinned DESC, created_at DESC LIMIT 100').all();
      return json({ posts: rows.results }, 200, { 'cache-control': 'public, max-age=30' });
    }

    if (parts[0] === 'content' && CONTENT_KEYS[parts[1]] && method === 'GET') {
      return json({ value: await getSetting(env, 'content:' + parts[1], null) }, 200, { 'cache-control': 'public, max-age=30' });
    }

    if (parts[0] === 'submit' && FORMS[parts[1]] && method === 'POST') return await submit(context, parts[1]);

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    await logError(env, 'server', '/api/' + route, err?.message || String(err), err?.stack);
    return json({ error: 'Something went wrong on our end. Please try again.' }, 500);
  }
}

async function submit({ request, env }, type) {
  const switches = await getSwitches(env);
  if (!switches.forms[type]) return json({ error: 'This form is closed right now. Please check back later.' }, 403);
  const key = await ipKey(request, env);
  if (await rateLimited(env, 'sub:' + key, 15, 3600000)) return json({ error: 'Too many submissions from this device. Please try again in an hour.' }, 429);
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_UPLOAD + 200000) return json({ error: 'That file is too big. Photos can be up to 10MB.' }, 413);
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: 'The form could not be read. Please try again.' }, 400);
  await noteAttempt(env, 'sub:' + key);
  if (String(form.get('website') || '').trim()) return json({ ok: true }); // honeypot: quietly drop bots

  const { data, file, errors } = validate(type, form);
  let fileKey = null;
  let fileType = null;
  let bytes = null;
  if (file) {
    if (file.blob.size > MAX_UPLOAD) errors[file.name] = 'That file is too big. Photos can be up to 10MB.';
    else {
      bytes = await file.blob.arrayBuffer();
      fileType = sniffImage(bytes);
      if (!fileType) errors[file.name] = 'Please upload a .jpg, .png, .webp, or .heic photo.';
    }
  }
  if (Object.keys(errors).length) return json({ error: 'Please fix the highlighted fields.', fields: errors }, 400);

  const id = newId();
  if (bytes) {
    fileKey = `${type}/${id}`;
    await env.FILES.put(fileKey, bytes, { metadata: { type: fileType } });
  }
  const status = FORMS[type].review ? 'pending' : 'new';
  await env.DB.prepare('INSERT INTO submissions (id, type, status, data, file_key, file_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, type, status, JSON.stringify(data), fileKey, fileType, now()).run();
  return json({ ok: true });
}

// ---------------- Admin ----------------
async function admin({ request, env }, parts, method) {
  const route = parts.join('/');
  if (route === 'login' && method === 'POST') {
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: 'The admin password has not been set up on the server yet.' }, 503);
    const key = 'login:' + (await ipKey(request, env));
    if (await rateLimited(env, key, 8, 900000)) return json({ error: 'Too many tries. Wait 15 minutes and try again.' }, 429);
    const body = await request.json().catch(() => ({}));
    if (!(await checkPassword(env, body.password))) {
      await noteAttempt(env, key);
      return json({ error: 'That password is not right.' }, 401);
    }
    return json({ ok: true }, 200, { 'set-cookie': await makeSessionCookie(env) });
  }
  if (!(await isAdmin(request, env))) return json({ error: 'Please sign in.' }, 401);
  // Cross-site protection: admin changes must come from the admin page's own scripts.
  if (method !== 'GET' && request.headers.get('x-whs-admin') !== '1') return json({ error: 'Blocked.' }, 403);

  if (route === 'logout' && method === 'POST') return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });

  if (route === 'overview' && method === 'GET') {
    const checks = {};
    const t0 = Date.now();
    try { await env.DB.prepare('SELECT 1').first(); checks.database = { ok: true, ms: Date.now() - t0 }; } catch (e) { checks.database = { ok: false, error: e.message }; }
    const t1 = Date.now();
    try { await env.FILES.list({ limit: 1 }); checks.fileStorage = { ok: true, ms: Date.now() - t1 }; } catch (e) { checks.fileStorage = { ok: false, error: e.message }; }
    checks.adminPassword = { ok: !!env.ADMIN_PASSWORD && String(env.ADMIN_PASSWORD).length >= 12 };
    const counts = await env.DB.prepare("SELECT type, status, COUNT(*) AS n FROM submissions GROUP BY type, status").all();
    const today = await env.DB.prepare('SELECT COALESCE(SUM(count),0) AS n FROM visits WHERE day = ?').bind(chicagoDay()).first();
    const since = new Date(Date.now() - 86400000).toISOString();
    const errs = await env.DB.prepare('SELECT COUNT(*) AS n FROM errors WHERE at > ?').bind(since).first();
    return json({
      checks, counts: counts.results, visitsToday: today.n, errors24h: errs.n,
      deploy: { commit: env.CF_PAGES_COMMIT_SHA || null, branch: env.CF_PAGES_BRANCH || null, url: env.CF_PAGES_URL || null },
      serverTime: now(),
    });
  }

  if (route === 'submissions' && method === 'GET') {
    const u = new URL(request.url);
    const type = u.searchParams.get('type');
    const status = u.searchParams.get('status');
    let sql = 'SELECT id, type, status, data, file_key, file_type, created_at, reviewed_at FROM submissions WHERE 1=1';
    const args = [];
    if (type) { sql += ' AND type = ?'; args.push(type); }
    if (status) { sql += ' AND status = ?'; args.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT 300';
    const rows = await env.DB.prepare(sql).bind(...args).all();
    return json({ items: rows.results.map((r) => ({ ...r, data: parse(r.data), hasFile: !!r.file_key })) });
  }

  if (parts[0] === 'submissions' && parts[1] && method === 'POST') {
    const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(parts[1]).first();
    if (!row) return json({ error: 'Not found' }, 404);
    const { action } = await request.json().catch(() => ({}));
    if (action === 'delete' || action === 'reject') {
      // Rejected and deleted uploads are removed, not stored (see the privacy page).
      if (row.file_key) await env.FILES.delete(row.file_key);
      if (action === 'delete') await env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(row.id).run();
      else await env.DB.prepare("UPDATE submissions SET status = 'rejected', file_key = NULL, reviewed_at = ? WHERE id = ?").bind(now(), row.id).run();
      return json({ ok: true });
    }
    const next = { approve: 'approved', done: 'done', reopen: FORMS[row.type]?.review ? 'pending' : 'new' }[action];
    if (!next) return json({ error: 'Unknown action' }, 400);
    await env.DB.prepare('UPDATE submissions SET status = ?, reviewed_at = ? WHERE id = ?').bind(next, now(), row.id).run();
    return json({ ok: true });
  }

  if (parts[0] === 'file' && parts[1] && method === 'GET') {
    const row = await env.DB.prepare('SELECT file_key, file_type FROM submissions WHERE id = ?').bind(parts[1]).first();
    if (!row?.file_key) return json({ error: 'Not found' }, 404);
    const file = await env.FILES.get(row.file_key, 'arrayBuffer');
    if (!file) return json({ error: 'Not found' }, 404);
    return new Response(file, { headers: { 'content-type': row.file_type, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
  }

  if (route === 'visits' && method === 'GET') {
    const days = Math.min(90, Math.max(7, Number(new URL(request.url).searchParams.get('days')) || 30));
    const from = chicagoDay(new Date(Date.now() - (days - 1) * 86400000));
    const daily = await env.DB.prepare('SELECT day, SUM(count) AS n FROM visits WHERE day >= ? GROUP BY day ORDER BY day').bind(from).all();
    const pages = await env.DB.prepare('SELECT path, SUM(count) AS n FROM visits WHERE day >= ? GROUP BY path ORDER BY n DESC LIMIT 25').bind(from).all();
    return json({ from, days, daily: daily.results, pages: pages.results });
  }

  if (route === 'errors' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM errors ORDER BY id DESC LIMIT 200').all();
    return json({ items: rows.results });
  }
  if (route === 'errors' && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM errors').run();
    return json({ ok: true });
  }

  if (route === 'settings' && method === 'GET') return json(await getSwitches(env));
  if (route === 'settings' && method === 'PUT') {
    const b = await request.json().catch(() => null);
    if (!b || typeof b !== 'object') return json({ error: 'Bad settings' }, 400);
    const clean = {
      welcome: !!b.welcome,
      banner: !!b.banner,
      bannerText: String(b.bannerText || '').slice(0, 200),
      bannerLink: /^(\/|https?:\/\/)/.test(String(b.bannerLink || '')) ? String(b.bannerLink).slice(0, 300) : '',
      sections: Object.fromEntries(Object.keys(DEFAULT_SWITCHES.sections).map((k) => [k, !!b.sections?.[k]])),
      forms: Object.fromEntries(Object.keys(DEFAULT_SWITCHES.forms).map((k) => [k, !!b.forms?.[k]])),
    };
    await putSetting(env, 'switches', clean);
    return json(clean);
  }

  if (parts[0] === 'content' && CONTENT_KEYS[parts[1]]) {
    const k = parts[1];
    if (method === 'GET') return json({ value: await getSetting(env, 'content:' + k, null) });
    if (method === 'PUT') {
      const b = await request.json().catch(() => null);
      const checked = CONTENT_KEYS[k].check(b?.value);
      if (checked.error) return json({ error: checked.error }, 400);
      await putSetting(env, 'content:' + k, checked.value);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM settings WHERE key = ?').bind('content:' + k).run();
      return json({ ok: true });
    }
  }

  if (route === 'posts' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM posts ORDER BY pinned DESC, created_at DESC').all();
    return json({ items: rows.results });
  }
  if ((route === 'posts' && method === 'POST') || (parts[0] === 'posts' && parts[1] && method === 'PUT')) {
    const b = await request.json().catch(() => ({}));
    const p = {
      title: String(b.title || '').trim().slice(0, 160),
      category: String(b.category || 'Reminders').slice(0, 40),
      summary: String(b.summary || '').trim().slice(0, 300),
      body: String(b.body || '').trim().slice(0, 20000),
      pinned: b.pinned ? 1 : 0,
      published: b.published === false ? 0 : 1,
    };
    if (!p.title || !p.body) return json({ error: 'A post needs a title and some text.' }, 400);
    if (parts[1]) {
      await env.DB.prepare('UPDATE posts SET title=?, category=?, summary=?, body=?, pinned=?, published=?, updated_at=? WHERE id=?')
        .bind(p.title, p.category, p.summary, p.body, p.pinned, p.published, now(), parts[1]).run();
      return json({ ok: true, id: parts[1] });
    }
    const id = newId();
    await env.DB.prepare('INSERT INTO posts (id, title, category, summary, body, pinned, published, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(id, p.title, p.category, p.summary, p.body, p.pinned, p.published, now(), now()).run();
    return json({ ok: true, id });
  }
  if (parts[0] === 'posts' && parts[1] && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(parts[1]).run();
    return json({ ok: true });
  }

  return json({ error: 'Not found' }, 404);
}
