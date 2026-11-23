(() => {
  const target = Date.parse(document.querySelector('#ceremony-start').dateTime);
  const clock = document.querySelector('.grad-clock');
  const digits = clock.querySelectorAll('b');
  function update() {
    const seconds = Math.ceil((target - Date.now()) / 1000);
    if (seconds <= 0) {
      clock.textContent = 'Congratulations, Class of 2027!';
      return;
    }
    const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
    digits.forEach((digit, i) => { digit.textContent = String(values[i]).padStart(2, '0'); });
    setTimeout(update, 1000);
  }
  update();
  clock.hidden = false;
})();
