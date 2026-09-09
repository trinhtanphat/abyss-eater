import { DEFAULT_SETTINGS, normalizeSettings, resolveQualityPreset } from '/client-settings.mjs';
import { createAudioController } from '/client-audio.mjs';

const SETTINGS_STORAGE_KEY = 'abyss-eater-settings-v1';
const CONNECTION_COPY = Object.freeze({
  ready: ['Ready', 'Choose a name and dive into the ocean.'],
  connecting: ['Connecting', 'Reaching the ocean server…'],
  online: ['Online', 'Connected to the ocean.'],
  reconnecting: ['Reconnecting', 'Trying to restore your fish…'],
  'upgrade-required': ['Upgrade required', 'Reload the game to use the current multiplayer protocol.'],
  offline: ['Connection issue', 'The realtime connection is temporarily unavailable.'],
});

function normalizeGameQuality(value) {
  const token = String(value || 'auto').toLowerCase();
  return token === 'balanced' ? 'medium' : token;
}

function readSettings(initialQuality) {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    return normalizeSettings({ ...parsed, quality: normalizeGameQuality(initialQuality || parsed.quality) });
  } catch {
    return normalizeSettings({ ...DEFAULT_SETTINGS, quality: normalizeGameQuality(initialQuality) });
  }
}

function writeSettings(settings) {
  try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

function qualityEnvironment() {
  return {
    width: innerWidth,
    devicePixelRatio: globalThis.devicePixelRatio || 1,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
  };
}

export function createClientPolish({ initialQuality = 'auto', onReducedEffects = () => {} } = {}) {
  const connectionBanner = document.querySelector('#connection-banner');
  const connectionBannerTitle = document.querySelector('#connection-banner-title');
  const connectionBannerMessage = document.querySelector('#connection-banner-message');
  const respawnCard = document.querySelector('#respawn-card');
  const respawnMessage = document.querySelector('#respawn-message');
  const qualitySetting = document.querySelector('#settings-quality-select');
  const reducedEffectsSetting = document.querySelector('#reduced-effects-setting');
  const masterVolume = document.querySelector('#master-volume');
  const musicVolume = document.querySelector('#music-volume');
  const sfxVolume = document.querySelector('#sfx-volume');
  const masterVolumeValue = document.querySelector('#master-volume-value');
  const musicVolumeValue = document.querySelector('#music-volume-value');
  const sfxVolumeValue = document.querySelector('#sfx-volume-value');

  let settings = readSettings(initialQuality);
  let respawnTimer = null;
  const audio = createAudioController({ getSettings: () => settings });

  function updateOutputs() {
    if (masterVolumeValue) masterVolumeValue.textContent = `${Math.round(settings.master * 100)}%`;
    if (musicVolumeValue) musicVolumeValue.textContent = `${Math.round(settings.music * 100)}%`;
    if (sfxVolumeValue) sfxVolumeValue.textContent = `${Math.round(settings.sfx * 100)}%`;
  }

  function syncControls() {
    if (qualitySetting) qualitySetting.value = normalizeGameQuality(settings.quality);
    if (reducedEffectsSetting) reducedEffectsSetting.checked = settings.reducedEffects;
    if (masterVolume) masterVolume.value = String(settings.master);
    if (musicVolume) musicVolume.value = String(settings.music);
    if (sfxVolume) sfxVolume.value = String(settings.sfx);
    updateOutputs();
  }

  function persistFromControls() {
    const previousReduced = settings.reducedEffects;
    settings = normalizeSettings({
      quality: normalizeGameQuality(qualitySetting?.value || settings.quality),
      reducedEffects: Boolean(reducedEffectsSetting?.checked),
      master: Number(masterVolume?.value ?? settings.master),
      music: Number(musicVolume?.value ?? settings.music),
      sfx: Number(sfxVolume?.value ?? settings.sfx),
    });
    writeSettings(settings);
    updateOutputs();
    if (previousReduced !== settings.reducedEffects) onReducedEffects(settings.reducedEffects);
    audio.stopAmbience();
    audio.startAmbience();
  }

  for (const control of [qualitySetting, reducedEffectsSetting, masterVolume, musicVolume, sfxVolume]) {
    control?.addEventListener('input', persistFromControls);
    control?.addEventListener('change', persistFromControls);
  }
  document.addEventListener('visibilitychange', () => { void audio.setSuspended(document.hidden); });
  syncControls();

  function resolvedQuality(requested = settings.quality) {
    const normalized = normalizeSettings({ ...settings, quality: normalizeGameQuality(requested) });
    const preset = resolveQualityPreset(normalized, qualityEnvironment());
    if (preset.pixelRatioCap <= 1) return 'low';
    if (preset.pixelRatioCap <= 1.5) return 'medium';
    return 'high';
  }

  function setRequestedQuality(value) {
    settings = normalizeSettings({ ...settings, quality: normalizeGameQuality(value) });
    writeSettings(settings);
    syncControls();
  }

  function setConnectionState(state, messageOverride = '') {
    const key = CONNECTION_COPY[state] ? state : 'offline';
    const [title, defaultMessage] = CONNECTION_COPY[key];
    document.body.dataset.connectionState = key;
    if (connectionBannerTitle) connectionBannerTitle.textContent = title;
    if (connectionBannerMessage) connectionBannerMessage.textContent = messageOverride || defaultMessage;
    if (connectionBanner) connectionBanner.hidden = key === 'ready' || key === 'online';
  }

  function showRespawn(by) {
    clearTimeout(respawnTimer);
    if (respawnMessage) respawnMessage.textContent = `Eaten by ${by || 'a bigger fish'}.`;
    if (respawnCard) respawnCard.hidden = false;
    respawnTimer = setTimeout(() => { if (respawnCard) respawnCard.hidden = true; }, settings.reducedEffects ? 900 : 1500);
  }

  return {
    get settings() { return { ...settings }; },
    resolvedQuality,
    setRequestedQuality,
    setConnectionState,
    showRespawn,
    async unlockAndStartAudio() {
      const unlocked = await audio.unlock();
      if (unlocked) {
        audio.playUi();
        audio.startAmbience();
      }
      return unlocked;
    },
    onSettingsOpen() { void audio.unlock().then((ok) => { if (ok) audio.playUi(); }); },
    onSettingsClose() { audio.playUi(); },
    playEat() { audio.playEat(); },
    playDeath() { audio.playDeath(); },
  };
}
