import { createEffectManager } from './game/effects.js';
import { createOceanEnvironment } from './game/environment.js';
import { animateFishRig, applyFishSnapshot, applyFishTheme, applyFoodTheme, createFishRig, createFoodMesh, disposeFishRig } from './game/fish.js';
import { createInputController } from './game/input.js';
import { createNetworkClient } from './game/network.js';
import { createGameScene } from './game/scene.js';
import { createClientState } from './game/state.js';
import { applyDocumentTheme, getTheme, themeIds } from './game/themes.js';
import { createHud } from './ui/hud.js';
import { createLobby } from './ui/lobby.js';
import { createToast } from './ui/toast.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '/client-settings.mjs';
import { createAudioController } from '/client-audio.mjs';

const SETTINGS_STORAGE_KEY = 'abyss-eater-settings-v1';
const gameRoot = document.querySelector('#game');
const fxLayer = document.querySelector('#fx-layer');
const toastElement = document.querySelector('#toast');
const connectionBanner = document.querySelector('#connection-banner');
const connectionBannerTitle = document.querySelector('#connection-banner-title');
const connectionBannerMessage = document.querySelector('#connection-banner-message');
const respawnCard = document.querySelector('#respawn-card');
const respawnMessage = document.querySelector('#respawn-message');
const reducedEffectsSetting = document.querySelector('#reduced-effects-setting');
const masterVolume = document.querySelector('#master-volume');
const musicVolume = document.querySelector('#music-volume');
const sfxVolume = document.querySelector('#sfx-volume');
const masterVolumeValue = document.querySelector('#master-volume-value');
const musicVolumeValue = document.querySelector('#music-volume-value');
const sfxVolumeValue = document.querySelector('#sfx-volume-value');
const systemReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function readClientSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return normalizeSettings(stored ? JSON.parse(stored) : DEFAULT_SETTINGS);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeClientSettings(value) {
  try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value)); } catch {}
}

let settings = readClientSettings();
const audio = createAudioController({ getSettings: () => settings });
const showToast = createToast(toastElement);
const state = createClientState();
const hud = createHud();

let sceneContext = null;
let environment = null;
let effects = null;
let input = null;
let network = null;
let activeTheme = getTheme('stylized');
let activeQuality = settings.quality;
let started = false;
let connected = false;
let statusText = 'Ready';
let pingMs = null;
let demoFish = null;
let lastFrameAt = performance.now();
let respawnTimer = null;

const playerMeshes = new Map();
const wildlifeMeshes = new Map();
const foodMeshes = new Map();

function effectiveReducedMotion() {
  return systemReducedMotion || settings.reducedEffects;
}

function statusState(message, isConnected) {
  if (isConnected) return 'online';
  const token = String(message || '').toLowerCase();
  if (token.includes('upgrade')) return 'upgrade-required';
  if (token.includes('reconnecting')) return 'reconnecting';
  if (token.includes('connecting')) return 'connecting';
  if (token.includes('issue') || token.includes('offline')) return 'offline';
  return 'ready';
}

function setConnectionState(stateName, title, message, isConnected = false) {
  document.body.dataset.connectionState = stateName;
  document.body.classList.toggle('connected', isConnected);
  if (connectionBannerTitle) connectionBannerTitle.textContent = title;
  if (connectionBannerMessage) connectionBannerMessage.textContent = message;
  if (connectionBanner) connectionBanner.hidden = stateName === 'ready' || stateName === 'online';
}

function syncVolumeOutputs() {
  if (masterVolume) masterVolume.value = String(settings.master);
  if (musicVolume) musicVolume.value = String(settings.music);
  if (sfxVolume) sfxVolume.value = String(settings.sfx);
  if (reducedEffectsSetting) reducedEffectsSetting.checked = settings.reducedEffects;
  if (masterVolumeValue) masterVolumeValue.textContent = `${Math.round(settings.master * 100)}%`;
  if (musicVolumeValue) musicVolumeValue.textContent = `${Math.round(settings.music * 100)}%`;
  if (sfxVolumeValue) sfxVolumeValue.textContent = `${Math.round(settings.sfx * 100)}%`;
}

function updateLocalSettings() {
  settings = normalizeSettings({
    ...settings,
    quality: activeQuality,
    reducedEffects: Boolean(reducedEffectsSetting?.checked),
    master: Number(masterVolume?.value),
    music: Number(musicVolume?.value),
    sfx: Number(sfxVolume?.value),
  });
  writeClientSettings(settings);
  syncVolumeOutputs();
  sceneContext?.setReducedMotion(effectiveReducedMotion());
  rebuildEffects();
  audio.stopAmbience();
  audio.startAmbience();
}

for (const control of [reducedEffectsSetting, masterVolume, musicVolume, sfxVolume]) {
  control?.addEventListener('input', updateLocalSettings);
  control?.addEventListener('change', updateLocalSettings);
}
syncVolumeOutputs();

function renderHud() {
  const threat = hud.render({ snapshot: state.snapshot, clientId: state.clientId, bounds: state.bounds, room: state.room, pingMs, statusText, connected });
  effects?.danger(threat.level !== 'safe');
}

function setTheme(id) {
  activeTheme = getTheme(id);
  applyDocumentTheme(activeTheme);
  sceneContext?.applyTheme(activeTheme);
  environment?.applyTheme(activeTheme);
  for (const rig of playerMeshes.values()) applyFishTheme(rig, activeTheme);
  for (const rig of wildlifeMeshes.values()) applyFishTheme(rig, activeTheme);
  for (const mesh of foodMeshes.values()) applyFoodTheme(mesh, activeTheme);
  if (demoFish) applyFishTheme(demoFish, activeTheme);
}

function rebuildEnvironment() {
  if (!sceneContext) return;
  environment?.dispose();
  environment = createOceanEnvironment(sceneContext.scene, { theme: activeTheme, profile: sceneContext.profile });
}

function rebuildEffects() {
  if (!sceneContext) return;
  effects?.dispose();
  effects = createEffectManager(sceneContext.scene, {
    profile: sceneContext.profile,
    reducedMotion: effectiveReducedMotion(),
    fxLayer,
    onCameraKick: (amount) => sceneContext.kickCamera(amount),
  });
}

function setQuality(value) {
  activeQuality = value;
  settings = normalizeSettings({ ...settings, quality: value });
  writeClientSettings(settings);
  if (!sceneContext) return;
  sceneContext.applyQuality(value);
  rebuildEnvironment();
  rebuildEffects();
}

function ensurePlayerMesh(player) {
  let rig = playerMeshes.get(player.id);
  if (!rig) {
    rig = createFishRig({ id: player.id, isLocal: player.id === state.clientId, theme: activeTheme });
    rig.position.set(Number(player.position?.x) || 0, Number(player.position?.y) || 0, Number(player.position?.z) || 0);
    rig.userData.target.copy(rig.position);
    rig.userData.previousTarget.copy(rig.position);
    sceneContext.scene.add(rig);
    playerMeshes.set(player.id, rig);
  }
  applyFishSnapshot(rig, player);
  return rig;
}

function ensureWildlifeMesh(actor) {
  let rig = wildlifeMeshes.get(actor.id);
  if (!rig) {
    rig = createFishRig({ id: `wildlife-${actor.id}`, isLocal: false, theme: activeTheme });
    rig.position.set(Number(actor.position?.x) || 0, Number(actor.position?.y) || 0, Number(actor.position?.z) || 0);
    rig.userData.target.copy(rig.position);
    rig.userData.previousTarget.copy(rig.position);
    sceneContext.scene.add(rig);
    wildlifeMeshes.set(actor.id, rig);
  }
  applyFishSnapshot(rig, actor);
  return rig;
}

function ensureFoodMesh(food) {
  let mesh = foodMeshes.get(food.id);
  if (!mesh) {
    mesh = createFoodMesh(activeTheme);
    sceneContext.scene.add(mesh);
    foodMeshes.set(food.id, mesh);
  }
  mesh.position.set(Number(food.position?.x) || 0, Number(food.position?.y) || 0, Number(food.position?.z) || 0);
  return mesh;
}

function showRespawn(by) {
  clearTimeout(respawnTimer);
  if (respawnMessage) respawnMessage.textContent = `Eaten by ${by || 'a larger fish'}.`;
  if (respawnCard) respawnCard.hidden = false;
  respawnTimer = setTimeout(() => {
    if (respawnCard) respawnCard.hidden = true;
  }, settings.reducedEffects ? 900 : 1500);
}

function syncSnapshot(changes = null) {
  const livePlayers = new Set();
  for (const player of state.snapshot.players) {
    livePlayers.add(player.id);
    ensurePlayerMesh(player);
  }
  for (const [id, rig] of playerMeshes) {
    if (!livePlayers.has(id)) {
      sceneContext.scene.remove(rig);
      disposeFishRig(rig);
      playerMeshes.delete(id);
    }
  }

  const liveWildlife = new Set();
  for (const actor of state.snapshot.wildlife) {
    liveWildlife.add(actor.id);
    ensureWildlifeMesh(actor);
  }
  for (const [id, rig] of wildlifeMeshes) {
    if (!liveWildlife.has(id)) {
      sceneContext.scene.remove(rig);
      disposeFishRig(rig);
      wildlifeMeshes.delete(id);
    }
  }

  const liveFood = new Set();
  for (const food of state.snapshot.food) {
    liveFood.add(food.id);
    ensureFoodMesh(food);
  }
  for (const [id, mesh] of foodMeshes) {
    if (!liveFood.has(id)) {
      sceneContext.scene.remove(mesh);
      mesh.userData.foodMaterial?.dispose?.();
      foodMeshes.delete(id);
    }
  }

  if (changes?.me && changes.previous) {
    const localRig = playerMeshes.get(state.clientId);
    const effectPosition = localRig?.position || new sceneContext.THREE.Vector3(
      Number(changes.me.position?.x) || 0,
      Number(changes.me.position?.y) || 0,
      Number(changes.me.position?.z) || 0,
    );
    if (changes.scoreDelta > 0) {
      audio.playEat();
      if (changes.scoreDelta >= 50) {
        effects?.eat(effectPosition, changes.scoreDelta, activeTheme.fish.local);
        showToast(`Devoured! +${Math.round(changes.scoreDelta)} score`, 'success', 1250);
      } else {
        effects?.food(effectPosition, changes.scoreDelta, activeTheme.food.color);
      }
    }
    const previousTier = Math.floor(Math.log2(Math.max(1, Number(changes.previous.mass) || 1)));
    const currentTier = Math.floor(Math.log2(Math.max(1, Number(changes.me.mass) || 1)));
    if (changes.massDelta > 0 && currentTier > previousTier) effects?.growth(effectPosition);
    if (changes.deathDelta > 0) effects?.respawn();
  }
  renderHud();
}

const lobby = createLobby({
  onPlay: (preferences) => {
    started = true;
    if (demoFish) {
      sceneContext.scene.remove(demoFish);
      disposeFishRig(demoFish);
      demoFish = null;
    }
    setTheme(preferences.theme);
    setQuality(preferences.quality);
    input.setPointerEnabled(preferences.pointerSteering);
    input.setEnabled(true);
    void audio.unlock().then((unlocked) => {
      if (unlocked) {
        audio.playUi();
        audio.startAmbience();
      }
    });
    network.connect({ name: preferences.name, room: preferences.room });
    statusText = 'Connecting…';
    setConnectionState('connecting', 'Connecting', 'Reaching the ocean server…');
    renderHud();
  },
  onTheme: (id) => setTheme(id),
  onQuality: (quality) => setQuality(quality),
  onPointer: (enabled) => input?.setPointerEnabled(enabled),
  onSettingsOpen: () => {
    input?.setEnabled(false);
    document.exitPointerLock?.();
    void audio.unlock().then((unlocked) => { if (unlocked) audio.playUi(); });
  },
  onSettingsClose: () => {
    if (started && !network?.protocolBlocked) input?.setEnabled(true);
  },
});

lobby.setThemeOptions(themeIds());
const initialPreferences = lobby.preferences();
activeTheme = getTheme(initialPreferences.theme);
activeQuality = initialPreferences.quality;
settings = normalizeSettings({ ...settings, quality: activeQuality });
writeClientSettings(settings);
applyDocumentTheme(activeTheme);

sceneContext = createGameScene(gameRoot, { theme: activeTheme, quality: activeQuality, reducedMotion: effectiveReducedMotion() });
environment = createOceanEnvironment(sceneContext.scene, { theme: activeTheme, profile: sceneContext.profile });
effects = createEffectManager(sceneContext.scene, {
  profile: sceneContext.profile,
  reducedMotion: effectiveReducedMotion(),
  fxLayer,
  onCameraKick: (amount) => sceneContext.kickCamera(amount),
});

input = createInputController({
  canvas: sceneContext.renderer.domElement,
  joystick: document.querySelector('#touch-joystick'),
  joystickKnob: document.querySelector('#joystick-knob'),
  upButton: document.querySelector('#touch-up'),
  downButton: document.querySelector('#touch-down'),
  pointerToggle: document.querySelector('#pointer-steering'),
  onHint: (message) => showToast(message, 'info', 1500),
});
input.setPointerEnabled(initialPreferences.pointerSteering);

network = createNetworkClient({
  onStatus(message, isConnected) {
    statusText = message;
    connected = isConnected;
    const stateName = statusState(message, isConnected);
    const description = stateName === 'reconnecting'
      ? 'Trying to restore your fish…'
      : stateName === 'upgrade-required'
        ? 'Reload the game to use the current multiplayer protocol.'
        : stateName === 'offline'
          ? 'The realtime connection is temporarily unavailable.'
          : stateName === 'connecting'
            ? 'Reaching the ocean server…'
            : 'Connected to the ocean.';
    setConnectionState(stateName, message, description, isConnected);
    renderHud();
  },
  onWelcome(message) {
    const changes = state.welcome(message);
    syncSnapshot(changes);
    setConnectionState('online', 'Online', message.resumed ? 'Your fish was resumed.' : 'You entered the ocean.', true);
    showToast(message.resumed ? 'Reconnected to your fish' : `Entered ${message.room || 'the ocean'}`, 'success', 1500);
  },
  onSnapshot(message) {
    const changes = state.applySnapshot(message);
    syncSnapshot(changes);
  },
  onPong(value) {
    pingMs = value;
    renderHud();
  },
  onEaten(message) {
    audio.playDeath();
    effects?.respawn();
    showRespawn(message.by);
    showToast(`Eaten by ${message.by || 'a larger fish'} — respawning`, 'danger', 1900);
  },
  onError(message) {
    showToast(`Server rejected input: ${message.code || 'unknown'}`, 'danger', 1800);
  },
  onProtocolMismatch() {
    input.setEnabled(false);
    setConnectionState('upgrade-required', 'Upgrade required', 'Reload the game to use the current multiplayer protocol.');
    showToast('Upgrade required · reload the game', 'danger', 3200);
  },
});

// Lightweight procedural hero fish: no binary model asset or paid dependency.
demoFish = createFishRig({ id: 'abyss-hero', isLocal: true, theme: activeTheme });
demoFish.position.set(-1, 1.2, 0);
demoFish.userData.target.copy(demoFish.position);
demoFish.userData.previousTarget.copy(demoFish.position);
demoFish.userData.mass = 2.4;
sceneContext.scene.add(demoFish);

setConnectionState('ready', 'Ready', 'Choose a fish name and dive into the ocean.');
setInterval(() => { if (started) network.sendInput(input.direction()); }, 100);
setInterval(() => { if (started) network.ping(); }, 2000);

document.addEventListener('visibilitychange', () => {
  void audio.setSuspended(document.hidden);
});

function animate(time) {
  const delta = Math.min(0.05, Math.max(0, (time - lastFrameAt) / 1000));
  lastFrameAt = time;
  environment?.update(time);
  effects?.update(delta);

  for (const mesh of foodMeshes.values()) {
    mesh.rotation.x += delta * 0.72;
    mesh.rotation.y += delta * 0.94;
    const pulse = settings.reducedEffects ? 1 : 1 + Math.sin(time * 0.0025 + mesh.position.x) * 0.035;
    mesh.scale.setScalar(pulse);
  }
  for (const [id, rig] of playerMeshes) animateFishRig(rig, time, id === state.clientId);
  for (const rig of wildlifeMeshes.values()) animateFishRig(rig, time, false);

  let cameraTarget = playerMeshes.get(state.clientId) || null;
  let cameraMass = state.localPlayer()?.mass || 1;
  if (!started && demoFish) {
    const seconds = time * 0.001;
    demoFish.userData.previousTarget.copy(demoFish.userData.target);
    demoFish.userData.target.set(
      Math.sin(seconds * 0.34) * 2.6 - 0.8,
      1.2 + Math.sin(seconds * 0.56) * 0.8,
      Math.cos(seconds * 0.34) * 2.1,
    );
    animateFishRig(demoFish, time, true);
    cameraTarget = demoFish;
    cameraMass = 2.4;
  }
  sceneContext.follow(cameraTarget, cameraMass, delta, input.look());
  sceneContext.render();
}

sceneContext.renderer.setAnimationLoop(animate);
renderHud();