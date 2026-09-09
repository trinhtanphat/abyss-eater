export function createToast(element) {
  let timer = null;
  return function showToast(message, tone = 'info', duration = 1800) {
    if (!element) return;
    clearTimeout(timer);
    element.textContent = String(message || '');
    element.dataset.tone = tone;
    element.classList.add('show');
    timer = setTimeout(() => element.classList.remove('show'), duration);
  };
}
