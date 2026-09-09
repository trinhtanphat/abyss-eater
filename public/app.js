import { createEffectManager } from './game/effects.js';
import { createOceanEnvironment } from './game/environment.js';
import { animateFishRig, applyFishSnapshot, applyFishTheme, applyFoodTheme, createFishRig, createFoodMesh } from './game/fish.js';
import { createInputController } from './game/input.js';
import { createNetworkClient } from './game/network.js';
import { createGameScene } from './game/scene.js';
import { createClientState } from './game/state.js';
import { applyDocumentTheme, getTheme, themeIds } from './game/themes.js';
import { createHud } from './ui/hud.js';
import { createLobby } from './ui/lobby.js';
import { createToast } from './ui/toast.js';

const gameRoot = document.querySelector('#game');
const fxLayer = document.querySelector('#fx-layer');
const toastElement = document.querySelector('#toast');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const showToast = createToast(toastElement);
const state = createClientState();
const hud = createHud();

let sceneContext = null;
let environment = null;
let effects = null;
let input = null;
let network = null;
let activeTheme = getTheme('stylized');
let activeQuality = 'auto';
let started = false;
let connected = false;
let statusText = 'Ready';
let pingMs = null;
let demoFish = null;
let lastFrameAt = performance.now();

const playerMeshes = new Map();
const foodMeshes = new Map();

function renderHud() {
  const threat = hud.render({
    snapshot: state.snapshot,
    clientId: state.clientId,
    bounds: state.bounds,
    room: state.room,
    pingMs,
    statusText,
    connected,
  });
  effects?.danger(threat.level !== 'safe');
}

function setTheme(id) {
  activeTheme = getTheme(id);
  applyDocumentTheme(activeTheme);
  sceneContext?.applyTheme(activeTheme);
  environment?.applyTheme(activeTheme);
  for (const rig of playerMeshes.values()) applyFishTheme(rig, activeTheme);
  for (const mesh of foodMeshes.values()) applyFoodTheme(mesh, activeTheme);
  if (demoFish) applyFishTheme(demoFish, activeTheme);
}

function rebuildEnvironment() {
  if (!sceneContext) return;
  environment?.dispose();
  environment = createOceanEnvironment(sceneContext.scene, {
    theme: activeTheme,
    profile: sceneContext.profile,
  });
}

function rebuildEffects() {
  if (!sceneContext) return;
  effects?.dispose();
  effects = createEffectManager(sceneContext.scene, {
    profile: sceneContext.profile,
    reducedMotion,
    fxLayer,
    onCameraKick: (amount) => sceneContext.kickCamera(amount),
  });
}

function setQuality(value) {
  activeQuality = value;
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

function syncSnapshot(changes = null) {
  const livePlayers = new Set();
  for (const player of state.snapshot.players) {
    livePlayers.add(player.id);
    ensurePlayerMesh(player);
  }
  for (const [id, rig] of playerMeshes) {
    if (!livePlayers.has(id)) {
      sceneContext.scene.remove(rig);
      playerMeshes.delete(id);
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
      demoFish = null;
    }
    setTheme(preferences.theme);
    setQuality(preferences.quality);
    input.setPointerEnabled(preferences.pointerSteering);
    input.setEnabled(true);
    network.connect({ name: preferences.name, room: preferences.room });
    statusText = 'Connecting…';
    renderHud();
  },
  onTheme: (id) => setTheme(id),
  onQuality: (quality) => setQuality(quality),
  onPointer: (enabled) => input?.setPointerEnabled(enabled),
});

lobby.setThemeOptions(themeIds());
const initialPreferences = lobby.preferences();
activeTheme = getTheme(initialPreferences.theme);
activeQuality = initialPreferences.quality;
applyDocumentTheme(activeTheme);

sceneContext = createGameScene(gameRoot, {
  theme: activeTheme,
  quality: activeQuality,
  reducedMotion,
});
environment = createOceanEnvironment(sceneContext.scene, {
  theme: activeTheme,
  profile: sceneContext.profile,
});
effects = createEffectManager(sceneContext.scene, {
  profile: sceneContext.profile,
  reducedMotion,
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
});
input.setPointerEnabled(initialPreferences.pointerSteering);

network = createNetworkClient({
  onStatus(message, isConnected) {
    statusText = message;
    connected = isConnected;
    renderHud();
  },
  onWelcome(message) {
    const changes = state.welcome(message);
    syncSnapshot(changes);
    showToast(`Entered ${message.room || 'the ocean'}`, 'success', 1500);
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
    effects?.respawn();
    showToast(`Eaten by ${message.by || 'a larger fish'} — respawning`, 'danger', 1900);
  },
  onError(message) {
    showToast(`Server rejected input: ${message.code || 'unknown'}`, 'danger', 1800);
  },
});

// A lightweight procedural hero fish keeps the lobby alive without loading a model asset.
demoFish = createFishRig({ id: 'abyss-hero', isLocal: true, theme: activeTheme });
demoFish.position.set(-1, 1.2, 0);
demoFish.userData.target.copy(demoFish.position);
demoFish.userData.previousTarget.copy(demoFish.position);
demoFish.userData.mass = 2.4;
sceneContext.scene.add(demoFish);

setInterval(() => {
  if (started) network.sendInput(input.direction());
}, 100);

setInterval(() => {
  if (started) network.ping();
}, 2000);

function animate(time) {
  const delta = Math.min(0.05, Math.max(0, (time - lastFrameAt) / 1000));
  lastFrameAt = time;

  environment?.update(time);
  effects?.update(delta);

  for (const mesh of foodMeshes.values()) {
    mesh.rotation.x += delta * 0.72;
    mesh.rotation.y += delta * 0.94;
    const pulse = 1 + Math.sin(time * 0.0025 + mesh.position.x) * 0.035;
    mesh.scale.setScalar(pulse);
  }

  for (const [id, rig] of playerMeshes) {
    animateFishRig(rig, time, id === state.clientId);
  }

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

  sceneContext.follow(cameraTarget, cameraMass, delta);
  sceneContext.render();
}

sceneContext.renderer.setAnimationLoop(animate);
renderHud();
