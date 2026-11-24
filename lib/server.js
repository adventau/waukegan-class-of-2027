// Shared server helpers for the Cloudflare Pages Functions in functions/.
// Bindings (see wrangler.toml): DB = D1 database, FILES = KV store for uploads.
// Secrets: ADMIN_PASSWORD (the admin sign-in password), SESSION_SECRET (signs the admin cookie).

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export const now = () => new Date().toISOString();

export const chicagoDay = (d = new Date()) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Chicago' }).format(d);

export const newId = () => {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
};

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Anonymous per-visitor key used only for rate limits; never stored with submissions.
export async function ipKey(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  return (await sha256(ip + '|' + (env.SESSION_SECRET || ''))).slice(0, 32);
}

// ---------- Admin session ----------
const COOKIE = 'whs_admin';
const SESSION_DAYS = 7;

export async function makeSessionCookie(env) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const sig = await hmac(env.SESSION_SECRET, 'admin.' + exp);
  return `${COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearSessionCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function isAdmin(request, env) {
  if (!env.SESSION_SECRET || !env.ADMIN_PASSWORD) return false;
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=(\\d+)\\.([0-9a-f]{64})'));
  if (!m) return false;
  if (Number(m[1]) < Date.now()) return false;
  return safeEqual(await hmac(env.SESSION_SECRET, 'admin.' + m[1]), m[2]);
}

export async function checkPassword(env, given) {
  if (!env.ADMIN_PASSWORD || typeof given !== 'string') return false;
  return safeEqual(await sha256(given), await sha256(env.ADMIN_PASSWORD));
}

// Simple sliding-window limiter backed by the login_attempts table.
export async function rateLimited(env, key, max, windowMs) {
  const since = Date.now() - windowMs;
  await env.DB.prepare('DELETE FROM login_attempts WHERE at < ?').bind(Date.now() - 86400000).run();
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip_hash = ? AND at > ?').bind(key, since).first();
  return (row?.n || 0) >= max;
}
export async function noteAttempt(env, key) {
  await env.DB.prepare('INSERT INTO login_attempts (ip_hash, at) VALUES (?, ?)').bind(key, Date.now()).run();
}

// ---------- Settings ----------
export const DEFAULT_SWITCHES = {
  welcome: true,
  banner: false,
  bannerText: '',
  bannerLink: '',
  sections: { countdown: true, events: true, photos: true, spotlight: true },
  forms: { photo: true, contact: true, spotlight: true, directory: true, announcement: true, newsletter: true },
};

export async function getSetting(env, key, fallback = null) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}

export async function putSetting(env, key, value) {
  await env.DB.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .bind(key, JSON.stringify(value), now()).run();
}

export async function getSwitches(env) {
  const s = await getSetting(env, 'switches', {});
  return {
    ...DEFAULT_SWITCHES, ...s,
    sections: { ...DEFAULT_SWITCHES.sections, ...(s.sections || {}) },
    forms: { ...DEFAULT_SWITCHES.forms, ...(s.forms || {}) },
  };
}

// ---------- Errors ----------
export async function logError(env, source, path, message, detail) {
  try {
    await env.DB.prepare('INSERT INTO errors (at, source, path, message, detail) VALUES (?, ?, ?, ?, ?)')
      .bind(now(), source, String(path || '').slice(0, 300), String(message || 'Unknown error').slice(0, 500), detail ? String(detail).slice(0, 2000) : null).run();
    await env.DB.prepare('DELETE FROM errors WHERE id NOT IN (SELECT id FROM errors ORDER BY id DESC LIMIT 500)').run();
  } catch { /* never let error logging break a request */ }
}

// ---------- Uploads ----------
export const MAX_UPLOAD = 10 * 1024 * 1024;

// Identify an image by its first bytes rather than trusting the browser's label.
export function sniffImage(bytes) {
  const b = new Uint8Array(bytes.slice(0, 16));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  const brand = String.fromCharCode(...b.slice(4, 12));
  if (brand.startsWith('ftyp') && /heic|heix|mif1|msf1|hevc/.test(brand.slice(4))) return 'image/heic';
  return null;
}
