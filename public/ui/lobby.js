import { normalizeQuality, normalizeTheme } from '../game/presentation.js';
import { applyDocumentTheme } from '../game/themes.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '/client-settings.mjs';

const STORAGE = Object.freeze({
  name: 'abyss-eater-name',
  room: 'abyss-eater-room',
  theme: 'abyss-eater-theme',
  pointer: 'abyss-eater-pointer-steering',
  settings: 'abyss-eater-settings-v1',
});

function readStorage(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, String(value)); } catch {}
}

function readSettings() {
  try {
    const raw = localStorage.getItem(STORAGE.settings);
    return normalizeSettings(raw ? JSON.parse(raw) : DEFAULT_SETTINGS);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeQuality(quality) {
  const settings = readSettings();
  const next = normalizeSettings({ ...settings, quality });
  try { localStorage.setItem(STORAGE.settings, JSON.stringify(next)); } catch {}
  return next.quality;
}

export function createLobby({ onPlay = () => {}, onTheme = () => {}, onQuality = () => {}, onPointer = () => {}, onSettingsOpen = () => {}, onSettingsClose = () => {} } = {}) {
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

  nameInput.value = readStorage(STORAGE.name, nameInput.value);
  roomInput.value = readStorage(STORAGE.room, roomInput.value);
  const storedTheme = normalizeTheme(readStorage(STORAGE.theme, themeSelect.value));
  const storedQuality = normalizeQuality(readSettings().quality || qualitySelect.value);
  const storedPointer = readStorage(STORAGE.pointer, 'true') !== 'false';
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
    writeStorage(STORAGE.name, value.name);
    writeStorage(STORAGE.room, value.room);
    writeStorage(STORAGE.theme, value.theme);
    writeQuality(value.quality);
    writeStorage(STORAGE.pointer, value.pointerSteering);
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
    onSettingsClose();
  }

  function applyThemeSelection(rawValue) {
    const value = normalizeTheme(rawValue);
    themeSelect.value = value;
    if (settingsThemeSelect) settingsThemeSelect.value = value;
    writeStorage(STORAGE.theme, value);
    applyDocumentTheme(value);
    onTheme(value);
  }

  function applyQualitySelection(rawValue) {
    const value = normalizeQuality(rawValue);
    qualitySelect.value = value;
    if (settingsQualitySelect) settingsQualitySelect.value = value;
    writeQuality(value);
    onQuality(value);
  }

  function applyPointerSelection(rawValue) {
    const value = Boolean(rawValue);
    pointerToggle.checked = value;
    if (settingsPointerToggle) settingsPointerToggle.checked = value;
    writeStorage(STORAGE.pointer, value);
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
    if (next) onSettingsOpen();
    else onSettingsClose();
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
    get settingsOpen() { return Boolean(settingsPanel?.classList.contains('open')); },
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
