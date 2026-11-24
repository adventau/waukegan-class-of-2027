// Content the admin page can edit. Each one replaces the matching data in the site's own data files:
//   calendar -> schoolCalendar in /school-calendar.js (also re-draws the Events page)
//   fixtures -> teamFixtures + jvFixtures in /sports-data.js (also feeds the homepage game previews)
//   breaks   -> homeBreaks in /home-data.js (homepage break countdown)
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, max) => typeof v === 'string' && v.length <= max;
const link = (v) => typeof v === 'string' && v.length <= 300 && (v === '' || v.startsWith('/') || /^https?:\/\//.test(v));
const ANCHOR = /^[A-Za-z0-9_-]{1,80}$/;

function calendar(v) {
  if (!Array.isArray(v) || v.length > 2000) return { error: 'Events must be a list.' };
  for (const [i, r] of v.entries()) {
    if (!Array.isArray(r) || r.length !== 5) return { error: `Event ${i + 1} is incomplete.` };
    const [start, title, url, details, end] = r;
    if (!DATE.test(start)) return { error: `Event ${i + 1} needs a start date.` };
    if (!str(title, 200) || !title.trim()) return { error: `Event ${i + 1} needs a title.` };
    if (!link(url)) return { error: `Event ${i + 1} has a bad link.` };
    if (!str(details, 400)) return { error: `Event ${i + 1}: details are too long.` };
    if (!DATE.test(end) || end < start) return { error: `Event ${i + 1}: the end date must be on or after the start date.` };
  }
  return { value: [...v].sort((a, b) => a[0].localeCompare(b[0])) };
}

function teams(obj, label) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return `${label} schedules are missing.`;
  for (const [team, games] of Object.entries(obj)) {
    if (!/^[A-Za-z-]{2,40}$/.test(team) || !Array.isArray(games) || games.length > 200) return `${label}: "${team}" is not a valid team.`;
    for (const [i, g] of games.entries()) {
      if (!Array.isArray(g) || g.length !== 5) return `${label} ${team} game ${i + 1} is incomplete.`;
      const [date, title, time, venue, id] = g;
      if (!DATE.test(date)) return `${label} ${team} game ${i + 1} needs a date.`;
      if (!str(title, 160) || !title.trim()) return `${label} ${team} game ${i + 1} needs a matchup.`;
      if (!str(time, 40) || !str(venue, 160)) return `${label} ${team} game ${i + 1}: time or venue is too long.`;
      if (!ANCHOR.test(id)) return `${label} ${team} game ${i + 1} has a bad ID.`;
    }
    games.sort((a, b) => a[0].localeCompare(b[0]));
  }
  return null;
}

function fixtures(v) {
  if (!v || typeof v !== 'object') return { error: 'Schedules are missing.' };
  const e = teams(v.teamFixtures, 'Varsity') || teams(v.jvFixtures, 'JV');
  if (e) return { error: e };
  return { value: { teamFixtures: v.teamFixtures, jvFixtures: v.jvFixtures } };
}

function breaks(v) {
  if (!Array.isArray(v) || v.length > 30) return { error: 'Breaks must be a list.' };
  for (const [i, r] of v.entries()) {
    if (!Array.isArray(r) || r.length < 3 || r.length > 4) return { error: `Break ${i + 1} is incomplete.` };
    const [start, name, url, end] = r;
    if (!DATE.test(start)) return { error: `Break ${i + 1} needs a start date.` };
    if (!str(name, 100) || !name.trim()) return { error: `Break ${i + 1} needs a name.` };
    if (!link(url)) return { error: `Break ${i + 1} has a bad link.` };
    if (end !== undefined && end !== '' && (!DATE.test(end) || end < start)) return { error: `Break ${i + 1}: the end date must be on or after the start date.` };
  }
  return { value: [...v].map((r) => (r[3] ? r : r.slice(0, 3))).sort((a, b) => a[0].localeCompare(b[0])) };
}

export const CONTENT_KEYS = {
  calendar: { check: calendar },
  fixtures: { check: fixtures },
  breaks: { check: breaks },
};

// Homepage game previews, rebuilt from varsity schedules: [date, title, link, "Team label · time"]
export function homeGamesFrom(f) {
  const out = [];
  for (const [team, games] of Object.entries(f.teamFixtures || {})) {
    const [gender, ...sport] = team.split('-');
    const label = `${gender} varsity ${sport.join(' ').toLowerCase()}`;
    for (const [date, title, time, , id] of games) out.push([date, title, `/sports/#${id}`, `${label} · ${String(time).replace(/ CT$/, '')}`]);
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}
