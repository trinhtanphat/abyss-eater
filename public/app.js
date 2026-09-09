import { createEffectManager } from './game/effects.js';
import { createOceanEnvironment } from './game/environment.js';
import { biomeVisual } from './game/biomes.js';
import { animateFishRig, applyFishSnapshot, applyFishTheme, applyFoodTheme, createFishRig, createFoodMesh, disposeFishRig } from './game/fish.js';
import { createInputController } from './game/input.js';
import { createNetworkClient } from './game/network.js';
import { createGameScene } from './game/scene.js';
import { createClientState } from './game/state.js';
import { applyHazardSnapshot, applyPickupSnapshot, createHazardMesh, createPickupMesh, disposeWorldActorMesh } from './game/world-actors.js';
import { applyDocumentTheme, getTheme, themeIds } from './game/themes.js';
import { createHud } from './ui/hud.js';
import { createLobby } from './ui/lobby.js';
import { createToast } from './ui/toast.js';
import { DEFAULT_SETTINGS, normalizeSettings } from '/client-settings.mjs';
import { createAudioController } from '/client-audio.mjs';
import { createTtsController } from '/client-tts.mjs';
import { createProgressionClient, profileProgress, skinAction } from '/client-progression.mjs';
import { createSocialClient, loadMutedIds, saveMutedIds, toggleMutedId } from '/client-social.mjs';

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
const ttsEnabledSetting = document.querySelector('#tts-enabled-setting');
const ttsVolume = document.querySelector('#tts-volume');
const masterVolumeValue = document.querySelector('#master-volume-value');
const musicVolumeValue = document.querySelector('#music-volume-value');
const sfxVolumeValue = document.querySelector('#sfx-volume-value');
const ttsVolumeValue = document.querySelector('#tts-volume-value');
const profileLevel = document.querySelector('#profile-level');
const profileXp = document.querySelector('#profile-xp');
const profilePearls = document.querySelector('#profile-pearls');
const profileXpProgress = document.querySelector('#profile-xp-progress');
const profileStatus = document.querySelector('#profile-status');
const skinGrid = document.querySelector('#skin-grid');
const persistentLeaderboard = document.querySelector('#persistent-leaderboard');
const hudBiome = document.querySelector('#hud-biome');
const partyCodeInput = document.querySelector('#party-code');
const partyMembers = document.querySelector('#party-members');
const partyStatus = document.querySelector('#party-status');
const partyCreateButton = document.querySelector('#party-create');
const partyJoinButton = document.querySelector('#party-join');
const partyLeaveButton = document.querySelector('#party-leave');
const partyStartButton = document.querySelector('#party-start');
const chatLog = document.querySelector('#chat-log');
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('#chat-input');

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
const tts = createTtsController({ getSettings: () => settings });
const progression = createProgressionClient();
const social = createSocialClient({ getToken: () => progression.token });
let mutedIds = loadMutedIds();
let activePartyCode = '';

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
const hazardMeshes = new Map();
const pickupMeshes = new Map();

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
  if (ttsEnabledSetting) ttsEnabledSetting.checked = settings.ttsEnabled;
  if (ttsVolume) ttsVolume.value = String(settings.tts);
  if (reducedEffectsSetting) reducedEffectsSetting.checked = settings.reducedEffects;
  if (masterVolumeValue) masterVolumeValue.textContent = `${Math.round(settings.master * 100)}%`;
  if (musicVolumeValue) musicVolumeValue.textContent = `${Math.round(settings.music * 100)}%`;
  if (sfxVolumeValue) sfxVolumeValue.textContent = `${Math.round(settings.sfx * 100)}%`;
  if (ttsVolumeValue) ttsVolumeValue.textContent = `${Math.round(settings.tts * 100)}%`;
}

function updateLocalSettings() {
  settings = normalizeSettings({
    ...settings,
    quality: activeQuality,
    reducedEffects: Boolean(reducedEffectsSetting?.checked),
    master: Number(masterVolume?.value),
    music: Number(musicVolume?.value),
    sfx: Number(sfxVolume?.value),
    ttsEnabled: Boolean(ttsEnabledSetting?.checked),
    tts: Number(ttsVolume?.value),
  });
  writeClientSettings(settings);
  syncVolumeOutputs();
  if (!settings.ttsEnabled) tts.stop();
  sceneContext?.setReducedMotion(effectiveReducedMotion());
  rebuildEffects();
  audio.stopAmbience();
  audio.startAmbience();
}

for (const control of [reducedEffectsSetting, masterVolume, musicVolume, sfxVolume, ttsEnabledSetting, ttsVolume]) {
  control?.addEventListener('input', updateLocalSettings);
  control?.addEventListener('change', updateLocalSettings);
}
syncVolumeOutputs();

function progressionErrorLabel(code) {
  const labels = {
    locked: 'Level locked',
    insufficient_pearls: 'More pearls needed',
    already_owned: 'Already owned',
    not_owned: 'Skin not owned',
    persistence_unavailable: 'Profile service unavailable',
  };
  return labels[code] || 'Profile sync unavailable';
}

function renderProgression() {
  const snapshot = progression.snapshot();
  const profile = snapshot.profile;
  if (profile) {
    const progress = profileProgress(profile);
    if (profileLevel) profileLevel.textContent = String(progress.level);
    if (profileXp) profileXp.textContent = `${progress.xp} / ${progress.nextXp}`;
    if (profilePearls) profilePearls.textContent = String(Math.floor(Number(profile.pearls) || 0));
    if (profileXpProgress) profileXpProgress.style.width = `${Math.round(progress.progress * 100)}%`;
    if (profileStatus) profileStatus.textContent = profile.displayName || 'Ocean profile';
  } else {
    if (profileLevel) profileLevel.textContent = '\u2014';
    if (profileXp) profileXp.textContent = 'Sync on dive';
    if (profilePearls) profilePearls.textContent = '\u2014';
    if (profileXpProgress) profileXpProgress.style.width = '0%';
    if (profileStatus) profileStatus.textContent = 'Guest progression';
  }

  if (skinGrid) {
    const fragment = document.createDocumentFragment();
    for (const skin of snapshot.catalog) {
      const action = skinAction(skin, profile || {}, snapshot.ownedSkins);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'skin-card';
      button.dataset.action = action;
      button.dataset.skinId = skin.id;
      button.style.setProperty('--skin-body', skin.bodyColor || '#5de7d7');
      button.style.setProperty('--skin-accent', skin.accentColor || '#d9fff7');
      const swatch = document.createElement('i');
      swatch.className = 'skin-swatch';
      const title = document.createElement('strong');
      title.textContent = skin.title || skin.id;
      const hint = document.createElement('small');
      const hints = {
        selected: 'Selected',
        select: 'Select',
        buy: `${Math.max(0, Number(skin.price) || 0)} pearls`,
        locked: `Lv ${Math.max(1, Number(skin.unlockLevel) || 1)}`,
        insufficient: `${Math.max(0, Number(skin.price) || 0)} pearls`,
      };
      hint.textContent = hints[action] || 'Unavailable';
      button.append(swatch, title, hint);
      button.disabled = !profile || ['selected', 'locked', 'insufficient', 'unavailable'].includes(action);
      if (action === 'buy' || action === 'select') {
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            if (action === 'buy') await progression.purchaseSkin(skin.id);
            else await progression.selectSkin(skin.id);
            renderProgression();
            showToast(action === 'buy' ? `${skin.title || skin.id} unlocked` : `${skin.title || skin.id} selected`, 'success', 1500);
          } catch (error) {
            showToast(progressionErrorLabel(error?.code), 'danger', 1800);
            renderProgression();
          }
        });
      }
      fragment.append(button);
    }
    skinGrid.replaceChildren(fragment);
  }

  if (persistentLeaderboard) {
    const fragment = document.createDocumentFragment();
    snapshot.leaderboard.slice(0, 5).forEach((row, index) => {
      const item = document.createElement('li');
      item.className = 'persistent-row';
      const place = document.createElement('b');
      place.textContent = `#${index + 1}`;
      const name = document.createElement('span');
      name.textContent = row.displayName || 'Little Fish';
      const score = document.createElement('strong');
      score.textContent = String(Math.max(0, Math.floor(Number(row.bestScore) || 0)));
      item.append(place, name, score);
      fragment.append(item);
    });
    if (!snapshot.leaderboard.length) {
      const item = document.createElement('li');
      item.className = 'persistent-row';
      item.textContent = 'No ranked sessions yet';
      fragment.append(item);
    }
    persistentLeaderboard.replaceChildren(fragment);
  }
}

async function refreshProgression({ profile = true, leaderboard = true } = {}) {
  const jobs = [];
  if (profile && progression.token) jobs.push(progression.refreshProfile());
  if (leaderboard) jobs.push(progression.refreshLeaderboard(5));
  await Promise.allSettled(jobs);
  renderProgression();
}

function renderHud() {
  const currentBiome = biomeVisual(state.localPlayer()?.biome);
  if (hudBiome) hudBiome.textContent = currentBiome.label;
  environment?.applyBiome(currentBiome.id);
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
  environment.applyBiome(biomeVisual(state.localPlayer()?.biome).id);
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

function ensureHazardMesh(actor) {
  let mesh = hazardMeshes.get(actor.id);
  if (!mesh) {
    mesh = createHazardMesh(activeTheme);
    sceneContext.scene.add(mesh);
    hazardMeshes.set(actor.id, mesh);
  }
  applyHazardSnapshot(mesh, actor);
  return mesh;
}

function ensurePickupMesh(actor) {
  let mesh = pickupMeshes.get(actor.id);
  if (!mesh) {
    mesh = createPickupMesh(activeTheme);
    sceneContext.scene.add(mesh);
    pickupMeshes.set(actor.id, mesh);
  }
  applyPickupSnapshot(mesh, actor);
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

  const liveHazards = new Set();
  for (const actor of state.snapshot.hazards) {
    liveHazards.add(actor.id);
    ensureHazardMesh(actor);
  }
  for (const [id, mesh] of hazardMeshes) {
    if (!liveHazards.has(id)) {
      sceneContext.scene.remove(mesh);
      disposeWorldActorMesh(mesh);
      hazardMeshes.delete(id);
    }
  }

  const livePickups = new Set();
  for (const actor of state.snapshot.pickups) {
    livePickups.add(actor.id);
    ensurePickupMesh(actor);
  }
  for (const [id, mesh] of pickupMeshes) {
    if (!livePickups.has(id)) {
      sceneContext.scene.remove(mesh);
      disposeWorldActorMesh(mesh);
      pickupMeshes.delete(id);
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
        void tts.speak(`Nuốt cá thành công. Cộng ${Math.round(changes.scoreDelta)} điểm.`);
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

function socialErrorLabel(code) {
  const labels = {
    unauthorized: 'Persistent profile required',
    party_full: 'Party is full',
    party_not_found: 'Party not found',
    not_member: 'You are not in that party',
    leader_required: 'Only the party leader can start',
    matchmaker_unavailable: 'Quick Dive is temporarily unavailable',
  };
  return labels[code] || 'Social service unavailable';
}

async function ensureSocialSession() {
  const name = document.querySelector('#player-name')?.value || 'Little Fish';
  await progression.ensureSession(name);
  renderProgression();
  return progression.token;
}

function renderParty(party) {
  const value = party && typeof party === 'object' ? party : null;
  activePartyCode = value?.code || '';
  if (partyCodeInput && activePartyCode) partyCodeInput.value = activePartyCode;
  if (partyStatus) partyStatus.textContent = value ? `${value.members?.length || 0}/4 · ${activePartyCode}` : 'Solo';
  if (!partyMembers) return;
  const fragment = document.createDocumentFragment();
  for (const member of value?.members || []) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    const role = document.createElement('small');
    name.textContent = member.displayName || 'Little Fish';
    role.textContent = member.profileId === value.leaderId ? 'Leader' : 'Member';
    row.append(name, role);
    fragment.append(row);
  }
  partyMembers.replaceChildren(fragment);
}

function appendChat(message) {
  const id = String(message?.id || '');
  if (!chatLog || !id || mutedIds.includes(id)) return;
  const row = document.createElement('div');
  row.className = 'chat-message';
  const line = document.createElement('p');
  const author = document.createElement('strong');
  const text = document.createElement('span');
  author.textContent = message?.name || 'Fish';
  text.textContent = String(message?.text || '').slice(0, 160);
  line.append(author, text);
  row.append(line);

  if (id !== state.clientId) {
    const actions = document.createElement('div');
    actions.className = 'chat-actions';
    const mute = document.createElement('button');
    mute.type = 'button';
    mute.textContent = 'Mute';
    mute.addEventListener('click', () => {
      mutedIds = saveMutedIds(toggleMutedId(mutedIds, id));
      row.remove();
      showToast(`${author.textContent} muted locally`, 'info', 1400);
    });
    const report = document.createElement('button');
    report.type = 'button';
    report.textContent = 'Report';
    report.addEventListener('click', async () => {
      try {
        await ensureSocialSession();
        await social.report({ targetPlayerId: id, room: state.room || network?.credentials?.room, reason: 'abuse' });
        showToast('Report submitted', 'success', 1400);
      } catch (error) {
        showToast(socialErrorLabel(error?.code), 'danger', 1800);
      }
    });
    actions.append(mute, report);
    row.append(actions);
  }
  chatLog.append(row);
  while (chatLog.children.length > 50) chatLog.firstElementChild?.remove();
  chatLog.scrollTop = chatLog.scrollHeight;
}

function configureDivePresentation(preferences) {
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
    if (unlocked) { audio.playUi(); audio.startAmbience(); }
  });
}

async function beginDive(preferences, { quick = false, roomOverride = '', requireSession = false } = {}) {
  lobby.hide();
  configureDivePresentation(preferences);
  statusText = quick ? 'Matchmaking…' : 'Connecting…';
  setConnectionState('connecting', quick ? 'Finding ocean' : 'Connecting', quick ? 'Selecting a nearby room…' : 'Reaching the ocean server…');
  renderHud();

  let session = '';
  try {
    await progression.ensureSession(preferences.name);
    renderProgression();
    session = progression.token;
  } catch (error) {
    renderProgression();
    if (requireSession) {
      started = false;
      lobby.show();
      showToast(progressionErrorLabel(error?.code), 'danger', 1800);
      return;
    }
    showToast(progressionErrorLabel(error?.code), 'info', 1800);
  }

  let room = roomOverride || preferences.room;
  if (quick && !roomOverride) {
    try {
      const placement = await social.quickDive();
      room = String(placement?.room || '');
      if (!room) throw Object.assign(new Error('matchmaker_unavailable'), { code: 'matchmaker_unavailable' });
    } catch (error) {
      room = 'ocean-1';
      showToast(`${socialErrorLabel(error?.code)} · using fallback room`, 'info', 1800);
    }
  }
  network.connect({ name: preferences.name, room, session });
}

const lobby = createLobby({
  onPlay: (preferences) => { void beginDive(preferences); },
  onQuickDive: (preferences) => { void beginDive(preferences, { quick: true }); },
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
    void refreshProgression();
    setConnectionState('online', 'Online', message.resumed ? 'Your fish was resumed.' : 'You entered the ocean.', true);
    showToast(message.resumed ? 'Reconnected to your fish' : `Entered ${message.room || 'the ocean'}`, 'success', 1500);
    void tts.speak(message.resumed ? 'Đã kết nối lại với cá của bạn.' : 'Đã kết nối. Bạn đã vào đại dương.');
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
    void refreshProgression();
    audio.playDeath();
    effects?.respawn();
    showRespawn(message.by);
    showToast(`Eaten by ${message.by || 'a larger fish'} — respawning`, 'danger', 1900);
    void tts.speak(`Bạn đã bị ${message.by || 'một con cá lớn hơn'} ăn. Đang hồi sinh.`);
  },
  onChat(message) {
    appendChat(message);
  },
  onError(message) {
    const chatErrors = { chat_empty: 'Chat message is empty', chat_prohibited: 'Chat message blocked', chat_duplicate: 'Duplicate chat blocked', chat_rate_limited: 'Chat rate limited' };
    showToast(chatErrors[message.code] || `Server rejected input: ${message.code || 'unknown'}`, 'danger', 1800);
  },
  onProtocolMismatch() {
    input.setEnabled(false);
    setConnectionState('upgrade-required', 'Upgrade required', 'Reload the game to use the current multiplayer protocol.');
    showToast('Upgrade required · reload the game', 'danger', 3200);
  },
});

chatForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = String(chatInput?.value || '').trim();
  if (!text || !network?.sendChat(text)) return;
  chatInput.value = '';
});

partyCreateButton?.addEventListener('click', async () => {
  try {
    await ensureSocialSession();
    const result = await social.partyCreate();
    renderParty(result.party);
    showToast(`Party ${result.party?.code || ''} created`, 'success', 1500);
  } catch (error) { showToast(socialErrorLabel(error?.code), 'danger', 1800); }
});

partyJoinButton?.addEventListener('click', async () => {
  try {
    await ensureSocialSession();
    const result = await social.partyJoin(partyCodeInput?.value);
    renderParty(result.party);
    showToast('Joined party', 'success', 1400);
  } catch (error) { showToast(socialErrorLabel(error?.code), 'danger', 1800); }
});

partyLeaveButton?.addEventListener('click', async () => {
  const code = activePartyCode || partyCodeInput?.value;
  if (!code) return;
  try {
    await ensureSocialSession();
    await social.partyLeave(code);
    renderParty(null);
    if (partyCodeInput) partyCodeInput.value = '';
    showToast('Left party', 'info', 1400);
  } catch (error) { showToast(socialErrorLabel(error?.code), 'danger', 1800); }
});

partyStartButton?.addEventListener('click', async () => {
  const code = activePartyCode || partyCodeInput?.value;
  if (!code) return showToast('Create or join a party first', 'info', 1500);
  try {
    await ensureSocialSession();
    const placement = await social.partyQuickDive(code);
    renderParty(placement.party);
    await beginDive(lobby.persist(), { roomOverride: placement.room, requireSession: true });
  } catch (error) { showToast(socialErrorLabel(error?.code), 'danger', 1800); }
});

// Lightweight procedural hero fish: no binary model asset or paid dependency.
demoFish = createFishRig({ id: 'abyss-hero', isLocal: true, theme: activeTheme });
demoFish.position.set(-1, 1.2, 0);
demoFish.userData.target.copy(demoFish.position);
demoFish.userData.previousTarget.copy(demoFish.position);
demoFish.userData.mass = 2.4;
sceneContext.scene.add(demoFish);

setConnectionState('ready', 'Ready', 'Choose a fish name and dive into the ocean.');
renderProgression();
void refreshProgression({ profile: true, leaderboard: true });
setInterval(() => { if (started) network.sendInput(input.direction(), input.boosting()); }, 100);
setInterval(() => { if (started) network.ping(); }, 2000);

document.addEventListener('visibilitychange', () => {
  void audio.setSuspended(document.hidden);
  if (document.hidden) tts.stop();
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
  for (const mesh of hazardMeshes.values()) mesh.rotation.y += delta * 0.12;
  for (const mesh of pickupMeshes.values()) {
    mesh.rotation.y += delta * 0.85;
    if (!settings.reducedEffects) mesh.rotation.z = Math.sin(time * 0.0017 + mesh.position.x) * 0.12;
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