(() => {
  let mode = 'dark';
  try {
    if (localStorage.getItem('demo-theme') === 'light') mode = 'light';
  } catch {}
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle('dark', mode === 'dark');
})();

// Apply the admin page's on/off switches before the page draws (saved from the last visit; site-live.js refreshes them).
(() => {
  try {
    const s = JSON.parse(localStorage.getItem('whs-switches') || 'null');
    if (!s) return;
    for (const [k, on] of Object.entries(s.sections || {})) if (!on) document.documentElement.classList.add('sw-off-' + k);
    if (!s.welcome) document.documentElement.classList.add('sw-no-welcome');
  } catch {}
})();
