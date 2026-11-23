const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Chicago'}).format(new Date());
function fixtureRow(game) {
  const [date, title, time, venue, id] = game;
  const row = document.createElement('div');
  row.className = 'fixture-row';
  row.id = id;
  const heading = document.createElement('h4');
  heading.textContent = title;
  const when = document.createElement('time');
  when.dateTime = date;
  when.textContent = new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  const startTime = document.createElement('p');
  startTime.textContent = time;
  row.append(heading,when,startTime);
  {
    const location = document.createElement('p');
    location.textContent = venue || 'Venue pending';
    row.append(location);
  }
  return row;
}
for (const card of document.querySelectorAll('[data-team]')) {
  const picker = document.createElement('select');
  picker.className = 'level-picker';
  picker.setAttribute('aria-label', card.dataset.team.replace('-', ' ') + ' team level');
  for (const level of ['Varsity', 'JV']) picker.add(new Option(level,level));
  card.querySelector('.team-poster').append(picker);
  function renderSchedule() {
    const fixtures = picker.value === 'JV' ? jvFixtures : teamFixtures;
    const upcoming = (fixtures[card.dataset.team] || []).filter(game => game[0] >= today);
    const content = card.querySelector('.next-fixture');
    if (!upcoming.length) {
      content.textContent = picker.value + " schedule pending.";
      return;
    }
    content.replaceChildren(fixtureRow(upcoming[0]));
    if (upcoming.length > 1) {
      const more = document.createElement('details');
      const label = document.createElement('summary');
      label.textContent = 'Later games ('+(upcoming.length-1)+')';
      more.append(label,...upcoming.slice(1).map(fixtureRow));
      content.append(more);
    }
  }
  picker.addEventListener("change", renderSchedule);
  renderSchedule();
}
function revealGame() {
  const game = document.getElementById(location.hash.slice(1));
  if (!game) return;
  const schedule = game.closest('details');
  if (schedule) schedule.open = true;
  game.scrollIntoView({block:'center'});
}
if (location.hash.startsWith('#game-')) revealGame();
window.addEventListener('hashchange',revealGame);
