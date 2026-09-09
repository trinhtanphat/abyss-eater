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
  const settingsThemeSelect = document.querySelector('#settings-theme-select');
  const settingsQualitySelect = document.querySelector('#settings-quality-select');
  const settingsPointerToggle = document.querySelector('#settings-pointer-steering');

  nameInput.value = localStorage.getItem(STORAGE.name) || nameInput.value;
  roomInput.value = localStorage.getItem(STORAGE.room) || roomInput.value;
  const storedTheme = normalizeTheme(localStorage.getItem(STORAGE.theme) || themeSelect.value);
  const storedQuality = normalizeQuality(localStorage.getItem(STORAGE.quality) || qualitySelect.value);
  const storedPointer = localStorage.getItem(STORAGE.pointer) !== 'false';
  themeSelect.value = storedTheme;
  qualitySelect.value = storedQuality;
  pointerToggle.checked = storedPointer;
  if (settingsThemeSelect) settingsThemeSelect.value = storedTheme;
  if (settingsQualitySelect) settingsQualitySelect.value = storedQuality;
  if (settingsPointerToggle) settingsPointerToggle.checked = storedPointer;

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

  function applyThemeSelection(rawValue) {
    const value = normalizeTheme(rawValue);
    themeSelect.value = value;
    if (settingsThemeSelect) settingsThemeSelect.value = value;
    localStorage.setItem(STORAGE.theme, value);
    applyDocumentTheme(value);
    onTheme(value);
  }

  function applyQualitySelection(rawValue) {
    const value = normalizeQuality(rawValue);
    qualitySelect.value = value;
    if (settingsQualitySelect) settingsQualitySelect.value = value;
    localStorage.setItem(STORAGE.quality, value);
    onQuality(value);
  }

  function applyPointerSelection(rawValue) {
    const value = Boolean(rawValue);
    pointerToggle.checked = value;
    if (settingsPointerToggle) settingsPointerToggle.checked = value;
    localStorage.setItem(STORAGE.pointer, String(value));
    onPointer(value);
  }

  playButton.addEventListener('click', () => {
    const value = persist();
    hide();
    closeSettings();
    onPlay(value);
  });

  themeSelect.addEventListener('change', () => applyThemeSelection(themeSelect.value));
  settingsThemeSelect?.addEventListener('change', () => applyThemeSelection(settingsThemeSelect.value));
  qualitySelect.addEventListener('change', () => applyQualitySelection(qualitySelect.value));
  settingsQualitySelect?.addEventListener('change', () => applyQualitySelection(settingsQualitySelect.value));
  pointerToggle.addEventListener('change', () => applyPointerSelection(pointerToggle.checked));
  settingsPointerToggle?.addEventListener('change', () => applyPointerSelection(settingsPointerToggle.checked));

  settingsButton?.addEventListener('click', () => {
    const next = !settingsPanel?.classList.contains('open');
    settingsPanel?.classList.toggle('open', next);
    settingsButton.setAttribute('aria-expanded', String(next));
  });
  settingsClose?.addEventListener('click', closeSettings);

  applyDocumentTheme(themeSelect.value);

  function optionsFor(ids) {
    const labels = { stylized: 'Stylized', 'deep-sea': 'Deep Sea' };
    return ids.map((id) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = labels[id] || id;
      return option;
    });
  }

  return {
    preferences,
    persist,
    hide,
    show,
    closeSettings,
    setThemeOptions(ids) {
      const current = normalizeTheme(themeSelect.value);
      themeSelect.replaceChildren(...optionsFor(ids));
      settingsThemeSelect?.replaceChildren(...optionsFor(ids));
      const selected = ids.includes(current) ? current : ids[0];
      themeSelect.value = selected;
      if (settingsThemeSelect) settingsThemeSelect.value = selected;
    },
  };
}
