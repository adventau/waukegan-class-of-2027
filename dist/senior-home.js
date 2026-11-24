const dates = homeBreaks;
const games = homeGames;
const posters = ['❧','❄','✿','✦'];
const descriptions = ['Thanksgiving recess runs November 25–27.', 'Winter break runs December 21 through January 1.', 'Spring break runs March 22–26.', 'The final day of the 2026–27 school year.'];
const dayFormat = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Chicago'});
const longDate = new Intl.DateTimeFormat('en-US',{weekday:'long', month:'long', day:'numeric',year:'numeric',timeZone:'America/Chicago'});
let renderedDay = '';
let target = 0;
function escapeText(value) {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
}
function updateCalendar(now, today) {
  const upcoming = [...schoolCalendar, ...games].filter(([start]) => start >= today).sort((a,b) => a[0].localeCompare(b[0]));
  const nextBreak = dates.find(event => event[3] && event[3] >= today);
  const active = nextBreak && nextBreak[0] <= today;
  document.querySelector('#break-name').textContent = nextBreak ? (active ? 'On break · ' : 'Countdown to ') + nextBreak[1] : 'Next break dates pending';
  const clock = document.querySelector('#clock');
  clock.hidden = !nextBreak || active;
  document.querySelector('#break-date').textContent = nextBreak ? longDate.format(new Date(nextBreak[0]+'T12:00:00Z')) : '';
  if (nextBreak) {
    const noon = new Date(nextBreak[0]+'T12:00:00Z');
    const hour = Number(new Intl.DateTimeFormat('en-US',{hour:'numeric',hourCycle:'h23',timeZone:'America/Chicago'}).format(noon));
    target = noon.getTime() - hour * 3600000;
  }
  const list = document.querySelector('#event-list');
  list.replaceChildren();
  for (const event of upcoming.slice(0,3)) {
    const [start,title,url] = event;
    const i = new Date(start).getUTCMonth() % 4;
    const isGame = games.includes(event);
    const card = document.createElement('a');
    card.href = url;
    card.innerHTML = '<div class="poster tone-'+i+'" aria-hidden="true"><i>'+(isGame ? '🏀' : '◇')+'</i><b>'+escapeText(title)+'</b></div><div class="event-info"><time datetime="'+start+'">'+longDate.format(new Date(start+'T12:00:00Z'))+'</time><h3>'+escapeText(title)+'</h3><p>'+escapeText(event[3] || '')+'</p><strong>View details</strong></div>';
    list.append(card);
  }
  if (!upcoming.length) list.textContent = 'New event dates are pending.';
}
function tick() {
  const now = new Date();
  const today = dayFormat.format(now);
  if (today !== renderedDay) { updateCalendar(now,today); renderedDay = today; }
  const seconds = Math.max(0,Math.floor((target-now.getTime())/1000));
  const values = [Math.floor(seconds/86400),Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60];
  document.querySelectorAll('#clock b').forEach((cell,i) => {cell.textContent = String(values[i]).padStart(2,'0');});
}
tick();
setInterval(tick,1000);
const welcome = document.querySelector('#welcome');
let seen = false;
try { seen = localStorage.getItem('whs-welcome-complete') === 'yes'; } catch {}
if (!seen && !document.documentElement.classList.contains('sw-no-welcome')) welcome.showModal();
welcome.addEventListener('cancel', event => event.preventDefault());
welcome.addEventListener('close', () => {
  try { localStorage.setItem('whs-welcome-complete','yes'); } catch {}
});
