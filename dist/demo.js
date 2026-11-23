const root = document.documentElement;
const theme = document.querySelector('header button[aria-label*="mode"]');
const designButtons = document.querySelectorAll('[data-design]');
function applyDesign(design) {
  root.dataset.design = design;
  designButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.design === design)));
}
applyDesign('updated');
designButtons.forEach(button => button.addEventListener('click', () => applyDesign(button.dataset.design)));

function applyTheme(mode) {
  root.dataset.theme = mode;
  root.classList.toggle('dark', mode === 'dark');
  if (!theme) return;
  const label = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  theme.setAttribute('aria-label', label);
  theme.title = label;
  theme.textContent = mode === 'dark' ? '☀' : '☾';
}
applyTheme(root.dataset.theme);
theme?.addEventListener('click', () => {
  const mode = root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(mode);
  try { localStorage.setItem('demo-theme', mode); } catch {}
});
const menuLinks = [['Sports','/sports/'],['Events','/events'],['Class News','/announcements'],['Senior Checklist','/checklist/'],['Photos','/gallery'],['Resources','/resources'],['Graduation','/graduation'],['Spotlights','/spotlights'],['FAQ','/faq'],['Contact','/contact']];
document.querySelectorAll('header button[aria-haspopup],header button[aria-label="Open menu"],nav[aria-label="Quick navigation"] button').forEach(button => {
  const menu = document.createElement('div');
  menu.className = 'demo-menu';
  if (button.closest('nav[aria-label="Quick navigation"]')) menu.classList.add('mobile');
  menu.hidden = true;
  for (const [label, url] of menuLinks) {
    const link = document.createElement('a');
    link.href = url;
    link.textContent = label;
    menu.append(link);
  }
  button.after(menu);
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    button.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      button.focus();
    }
  });
});
document.querySelectorAll('[data-demo-form]').forEach(form => {
  form.addEventListener('submit', event => event.preventDefault());
  form.querySelectorAll('input, textarea, select, button').forEach(control => {control.disabled = true});
});
