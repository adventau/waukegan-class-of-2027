(() => {
  let mode = 'dark';
  try {
    if (localStorage.getItem('demo-theme') === 'light') mode = 'light';
  } catch {}
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle('dark', mode === 'dark');
})();
