const group = new URLSearchParams(location.search).get('group');
if (group === 'winter' || group === 'basketball') location.replace('/sports/');
else document.querySelector('[data-group=school]').setAttribute('aria-current','page');

function revealSchoolEvent(){
  const event = document.getElementById(location.hash.slice(1));
  if (!event) return;
  const month = event.closest('.calendar-month');
  if (month) { month.open = true; event.scrollIntoView({block:'center'}); }
}
revealSchoolEvent();
window.addEventListener('hashchange',revealSchoolEvent);
