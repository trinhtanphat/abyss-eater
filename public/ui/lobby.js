import { normalizeQuality, normalizeTheme } from '../game/presentation.js';
import { applyDocumentTheme } from '../game/themes.js';

const STORAGE = Object.freeze({
  name: 'abyss-eater-name',
  room: 'abyss-eater-room',
  theme: 'abyss-eater-theme',
  quality: 'abyss-eater-quality',
  pointer: 'abyss-eater-pointer-steering',
});

export function createLobby({ onPlay = () => {}, onTheme = () => {}, onQuality = () => {}, onPointer = () => {} } = {}) {
  const panel = document.querySelector('#start-screen');
  const playButton = document.querySelector('#play-button');
  const nameInput = document.querySelector('#player-name');
  const roomInput = document.querySelector('#room-name');
  const themeSelect = document.querySelector('#theme-select');
  const qualitySelect = document.querySelector('#quality-select');
  const pointerToggle = document.querySelector('#pointer-steering');
  const settingsButton = document.querySelector('#settings-button');
  const settingsPanel = document.querySelector('#settings-panel');
  const settingsClose = document.querySelector('#settings-close');

  nameInput.value = localStorage.getItem(STORAGE.name) || nameInput.value;
  roomInput.value = localStorage.getItem(STORAGE.room) || roomInput.value;
  themeSelect.value = normalizeTheme(localStorage.getItem(STORAGE.theme) || themeSelect.value);
  qualitySelect.value = normalizeQuality(localStorage.getItem(STORAGE.quality) || qualitySelect.value);
  pointerToggle.checked = localStorage.getItem(STORAGE.pointer) !== 'false';

  function preferences() {
    return {
      name: nameInput.value,
      room: roomInput.value,
      theme: normalizeTheme(themeSelect.value),
      quality: normalizeQuality(qualitySelect.value),
      pointerSteering: Boolean(pointerToggle.checked),
    };
  }

  function persist() {
    const value = preferences();
    localStorage.setItem(STORAGE.name, value.name);
    localStorage.setItem(STORAGE.room, value.room);
    localStorage.setItem(STORAGE.theme, value.theme);
    localStorage.setItem(STORAGE.quality, value.quality);
    localStorage.setItem(STORAGE.pointer, String(value.pointerSteering));
    return value;
  }

  function hide() {
    panel.classList.add('hidden');
    document.body.classList.add('playing');
  }

  function show() {
    panel.classList.remove('hidden');
    document.body.classList.remove('playing');
  }

  function closeSettings() {
    settingsPanel?.classList.remove('open');
    settingsButton?.setAttribute('aria-expanded', 'false');
  }

  playButton.addEventListener('click', () => {
    const value = persist();
    hide();
    closeSettings();
    onPlay(value);
  });

  themeSelect.addEventListener('change', () => {
    const id = normalizeTheme(themeSelect.value);
    localStorage.setItem(STORAGE.theme, id);
    applyDocumentTheme(id);
    onTheme(id);
  });

  qualitySelect.addEventListener('change', () => {
    const value = normalizeQuality(qualitySelect.value);
    localStorage.setItem(STORAGE.quality, value);
    onQuality(value);
  });

  pointerToggle.addEventListener('change', () => {
    localStorage.setItem(STORAGE.pointer, String(pointerToggle.checked));
    onPointer(Boolean(pointerToggle.checked));
  });

  settingsButton?.addEventListener('click', () => {
    const next = !settingsPanel?.classList.contains('open');
    settingsPanel?.classList.toggle('open', next);
    settingsButton.setAttribute('aria-expanded', String(next));
  });
  settingsClose?.addEventListener('click', closeSettings);

  applyDocumentTheme(themeSelect.value);

  return {
    preferences,
    persist,
    hide,
    show,
    closeSettings,
    setThemeOptions(ids) {
      const labels = { stylized: 'Stylized', 'deep-sea': 'Deep Sea' };
      const current = normalizeTheme(themeSelect.value);
      themeSelect.replaceChildren(...ids.map((id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = labels[id] || id;
        return option;
      }));
      themeSelect.value = ids.includes(current) ? current : ids[0];
    },
  };
}
