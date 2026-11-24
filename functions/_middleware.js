// Runs before every request.
// 1. Locks /admin: signed-out visitors get the sign-in screen, never the admin page itself.
// 2. Serves edited events, schedules and breaks in place of the site's original data files.
// 3. Records server errors for the admin Status tab.
import { isAdmin, getSetting, logError } from '../lib/server.js';
import { homeGamesFrom } from '../lib/content.js';

const NOINDEX = { 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };

async function withHeaders(res, headers) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) r.headers.set(k, v);
  return r;
}

async function dataFile(context, path) {
  const { env, next, request } = context;
  const keys = { '/school-calendar.js': ['calendar'], '/sports-data.js': ['fixtures'], '/home-data.js': ['breaks', 'fixtures'] }[path];
  // The admin page asks for ?original to see the file before any edits.
  if (new URL(request.url).searchParams.has('original') && (await isAdmin(request, env))) return next();
  const edits = {};
  for (const k of keys) edits[k] = await getSetting(env, 'content:' + k, null);
  if (Object.values(edits).every((v) => v == null)) return next();
  const original = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
  let text = await original.text();
  text += '\n// Edited from the admin page\n';
  if (path === '/school-calendar.js' && edits.calendar) text += `schoolCalendar = ${JSON.stringify(edits.calendar)};\n`;
  if (path === '/sports-data.js' && edits.fixtures) text += `teamFixtures = ${JSON.stringify(edits.fixtures.teamFixtures)};\njvFixtures = ${JSON.stringify(edits.fixtures.jvFixtures)};\n`;
  if (path === '/home-data.js') {
    if (edits.breaks) text += `homeBreaks = ${JSON.stringify(edits.breaks)};\n`;
    if (edits.fixtures) text += `homeGames = ${JSON.stringify(homeGamesFrom(edits.fixtures))};\n`;
  }
  return new Response(text, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=30' } });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  try {
    if (path === '/admin' || path.startsWith('/admin/')) {
      if (!(await isAdmin(request, env))) {
        const login = await env.ASSETS.fetch(new Request(new URL('/admin-login', url)));
        return withHeaders(new Response(login.body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }), NOINDEX);
      }
      return withHeaders(await next(), NOINDEX);
    }
    // The sign-in screen is only ever shown at /admin.
    if (path === '/admin-login.html' || path === '/admin-login') return new Response('Not found', { status: 404 });
    if (path.startsWith('/api/admin')) return withHeaders(await next(), NOINDEX);
    if (path === '/school-calendar.js' || path === '/sports-data.js' || path === '/home-data.js') return await dataFile(context, path);
    return await next();
  } catch (err) {
    await logError(env, 'server', path, err?.message || String(err), err?.stack);
    return new Response('Something went wrong. Please try again.', { status: 500 });
  }
}
