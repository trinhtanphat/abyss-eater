import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';
import { silhouetteForMass } from './fish-evolution.mjs';
import { skinVisual } from './skins.js';
import { skinPaletteFor } from './fish-skins.mjs';
import { createInterpolationBuffer, frameIndependentAlpha, renderServerTime } from './interpolation.mjs';

const BODY_GEOMETRY = new THREE.SphereGeometry(1, 26, 18);
const TAIL_GEOMETRY = new THREE.ConeGeometry(0.92, 1.35, 3);
const FIN_GEOMETRY = new THREE.ConeGeometry(0.62, 1.25, 3);
const SNOUT_GEOMETRY = new THREE.SphereGeometry(0.58, 18, 12);
const SPINE_GEOMETRY = new THREE.ConeGeometry(0.24, 0.82, 5);
const EYE_GEOMETRY = new THREE.SphereGeometry(0.14, 12, 9);
const PUPIL_GEOMETRY = new THREE.SphereGeometry(0.066, 10, 8);
const MOUTH_GEOMETRY = new THREE.TorusGeometry(0.16, 0.025, 6, 16, Math.PI);
const GILL_GEOMETRY = new THREE.TorusGeometry(0.28, 0.022, 6, 18, Math.PI * 1.2);
const LATERAL_LINE_GEOMETRY = new THREE.BoxGeometry(1.45, 0.028, 0.028);
const FOOD_BODY_GEOMETRY = new THREE.SphereGeometry(0.29, 12, 9);
const FOOD_FIN_GEOMETRY = new THREE.ConeGeometry(0.13, 0.38, 3);
const FOOD_CORE_GEOMETRY = new THREE.IcosahedronGeometry(0.16, 1);
const FOOD_TENDRIL_GEOMETRY = new THREE.CylinderGeometry(0.014, 0.008, 0.34, 5);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const MOVE = new THREE.Vector3();
const TARGET_SCALE = new THREE.Vector3();

function idHue(id) {
  let hash = 0;
  for (const ch of String(id || 'fish')) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return Math.abs(hash % 360) / 360;
}

function fishBaseColor(id, isLocal, theme) {
  if (isLocal) return new THREE.Color(theme.fish.local);
  return new THREE.Color().setHSL(idHue(id), theme.fish.saturation, theme.fish.lightness);
}

function makeBodyMaterial(id, isLocal, theme) {
  const color = fishBaseColor(id, isLocal, theme);
  const emissive = color.clone().multiplyScalar(isLocal ? theme.fish.emissiveBoost : theme.fish.emissiveBoost * 0.42);
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: isLocal ? 1.15 : 0.72,
    roughness: theme.fish.roughness,
    metalness: theme.fish.metalness,
  });
}

function clampMaterialValue(value) {
  return Math.max(0, Math.min(1, value));
}

function applyFishAppearance(rig, theme) {
  const data = rig.userData;
  const visual = skinVisual(data.skinId);
  const fallback = skinPaletteFor(data.id, theme);
  data.skinFamilyId = fallback.id;
  const roughnessOffset = visual ? 0 : fallback.roughnessOffset;
  const metalnessOffset = visual ? 0 : fallback.metalnessOffset;
  const bodyColor = visual ? new THREE.Color(visual.bodyColor) : new THREE.Color(fallback.body);
  const finColor = visual ? new THREE.Color(visual.accentColor) : new THREE.Color(fallback.fin);
  const emissive = visual ? new THREE.Color(visual.emissive) : new THREE.Color(fallback.emissive);

  data.bodyMaterial.color.copy(bodyColor);
  data.bodyMaterial.emissive.copy(emissive);
  data.bodyMaterial.roughness = clampMaterialValue(theme.fish.roughness + roughnessOffset);
  data.bodyMaterial.metalness = clampMaterialValue(theme.fish.metalness + metalnessOffset);
  data.finMaterial.color.copy(finColor);
  data.finMaterial.emissive.copy(emissive);
  data.finMaterial.roughness = clampMaterialValue(theme.fish.roughness + 0.12 + roughnessOffset);
  data.finMaterial.metalness = clampMaterialValue(theme.fish.metalness + metalnessOffset);
  data.eyeMaterial.color.setHex(theme.fish.eye);
  data.eyeMaterial.emissive.setHex(theme.fish.eye);
  data.pupilMaterial.color.setHex(theme.fish.pupil);
  data.mouthMaterial.color.setHex(theme.fish.pupil);
  data.biolumeMaterial.color.set(visual?.accentColor || (data.isLocal ? theme.fish.local : fallback.accent));
  data.glowMaterial.color.set(visual?.emissive || (data.isLocal ? theme.fish.local : fallback.emissive));
}

function applyEvolutionSilhouette(rig, mass) {
  const data = rig.userData;
  const profile = silhouetteForMass(mass);
  if (data.appliedEvolutionTier === profile.id) return;

  data.body.scale.set(...profile.body);
  data.tail.scale.set(...profile.tail);
  data.dorsal.scale.set(...profile.fin);
  data.ventral.scale.set(profile.fin[0] * 0.66, profile.fin[1] * 0.62, profile.fin[2] * 0.78);
  for (const pivot of data.pectoralPivots) {
    pivot.children[0]?.scale.set(profile.fin[0] * 0.48, profile.fin[1] * 0.72, profile.fin[2] * 0.74);
  }

  data.snout.scale.set(profile.snoutScale, profile.snoutScale * 0.82, profile.snoutScale * 0.9);
  data.mouth.scale.setScalar(profile.mouthScale);
  for (const eye of data.eyes) eye.scale.setScalar(profile.eyeScale);
  for (const pupil of data.pupils) pupil.scale.setScalar(profile.eyeScale);

  for (let index = 0; index < data.spines.length; index += 1) {
    const spine = data.spines[index];
    spine.visible = index < profile.spineCount;
    spine.scale.set(0.72 + index * 0.08, 0.72 + profile.spineCount * 0.09, 0.52);
  }

  data.appliedEvolutionTier = profile.id;
}

export function createFishRig({ id, isLocal = false, theme }) {
  const group = new THREE.Group();
  group.name = `fish-${id}`;
  const bodyMaterial = makeBodyMaterial(id, isLocal, theme);
  const finMaterial = bodyMaterial.clone();
  finMaterial.roughness = Math.min(1, theme.fish.roughness + 0.12);

  const body = new THREE.Mesh(BODY_GEOMETRY, bodyMaterial);
  body.scale.set(1.82, 0.82, 0.76);
  group.add(body);

  const snout = new THREE.Mesh(SNOUT_GEOMETRY, bodyMaterial);
  snout.position.set(1.47, -0.02, 0);
  snout.scale.set(0.86, 0.72, 0.78);
  group.add(snout);

  const tailPivot = new THREE.Group();
  tailPivot.position.x = -1.72;
  const tail = new THREE.Mesh(TAIL_GEOMETRY, finMaterial);
  tail.rotation.z = -Math.PI / 2;
  tail.position.x = -0.55;
  tail.scale.set(1, 1, 0.28);
  tailPivot.add(tail);
  group.add(tailPivot);

  const dorsal = new THREE.Mesh(FIN_GEOMETRY, finMaterial);
  dorsal.position.set(-0.15, 0.9, 0);
  dorsal.rotation.z = Math.PI;
  dorsal.scale.set(0.72, 0.82, 0.2);
  group.add(dorsal);

  const ventral = new THREE.Mesh(FIN_GEOMETRY, finMaterial);
  ventral.position.set(-0.25, -0.78, 0);
  ventral.scale.set(0.52, 0.55, 0.16);
  group.add(ventral);

  const pectoralPivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.1, -0.18, side * 0.7);
    const fin = new THREE.Mesh(FIN_GEOMETRY, finMaterial);
    fin.rotation.z = -Math.PI / 2;
    fin.rotation.x = side * Math.PI / 2;
    fin.scale.set(0.48, 0.72, 0.15);
    pivot.add(fin);
    group.add(pivot);
    pectoralPivots.push(pivot);
  }

  const spines = [];
  for (let index = 0; index < 4; index += 1) {
    const spine = new THREE.Mesh(SPINE_GEOMETRY, finMaterial);
    spine.position.set(0.45 - index * 0.52, 0.78 - index * 0.035, 0);
    spine.rotation.z = Math.PI;
    spine.visible = false;
    group.add(spine);
    spines.push(spine);
  }

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: theme.fish.eye, roughness: 0.22, emissive: theme.fish.eye, emissiveIntensity: 0.08 });
  const pupilMaterial = new THREE.MeshBasicMaterial({ color: theme.fish.pupil });
  const eyes = [];
  const pupils = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(EYE_GEOMETRY, eyeMaterial);
    eye.position.set(1.43, 0.25, side * 0.53);
    const pupil = new THREE.Mesh(PUPIL_GEOMETRY, pupilMaterial);
    pupil.position.set(1.51, 0.25, side * 0.548);
    group.add(eye, pupil);
    eyes.push(eye);
    pupils.push(pupil);
  }

  const mouthMaterial = new THREE.MeshBasicMaterial({ color: theme.fish.pupil, transparent: true, opacity: 0.8 });
  const mouth = new THREE.Mesh(MOUTH_GEOMETRY, mouthMaterial);
  mouth.position.set(1.72, -0.12, 0);
  mouth.rotation.y = Math.PI / 2;
  mouth.rotation.z = -Math.PI / 2;
  group.add(mouth);

  const biolumeMaterial = new THREE.MeshBasicMaterial({
    color: theme.fish.local,
    transparent: true,
    opacity: isLocal ? 0.36 : 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const gillAccents = [];
  const lateralLines = [];
  for (const side of [-1, 1]) {
    const gill = new THREE.Mesh(GILL_GEOMETRY, biolumeMaterial);
    gill.position.set(1.02, 0.02, side * 0.61);
    gill.rotation.y = side * Math.PI / 2;
    gill.rotation.z = Math.PI / 2;
    group.add(gill);
    gillAccents.push(gill);

    const lateral = new THREE.Mesh(LATERAL_LINE_GEOMETRY, biolumeMaterial);
    lateral.position.set(-0.05, -0.04, side * 0.72);
    group.add(lateral);
    lateralLines.push(lateral);
  }

  const glowGeometry = new THREE.SphereGeometry(1.05, 16, 10);
  const glow = new THREE.Mesh(
    glowGeometry,
    new THREE.MeshBasicMaterial({ color: theme.fish.local, transparent: true, opacity: isLocal ? 0.05 : 0.018, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glow.scale.copy(body.scale).multiplyScalar(1.18);
  group.add(glow);

  group.userData = {
    ...group.userData,
    id,
    isLocal,
    body,
    snout,
    tail,
    bodyMaterial,
    finMaterial,
    eyeMaterial,
    pupilMaterial,
    mouthMaterial,
    biolumeMaterial,
    glowGeometry,
    glowMaterial: glow.material,
    tailPivot,
    pectoralPivots,
    dorsal,
    ventral,
    spines,
    eyes,
    pupils,
    mouth,
    gillAccents,
    lateralLines,
    appliedEvolutionTier: null,
    theme,
    skinId: '',
    target: new THREE.Vector3(),
    previousTarget: new THREE.Vector3(),
    interpolation: createInterpolationBuffer(),
    latestServerTime: 0,
    latestReceivedAt: 0,
    mass: 1,
    score: 0,
    deaths: 0,
    lastSpeed: 0,
  };
  applyEvolutionSilhouette(group, 1);
  applyFishAppearance(group, theme);
  return group;
}

export function applyFishSnapshot(rig, player, timing = {}) {
  if (!rig || !player?.position) return;
  const data = rig.userData;
  const local = Boolean(timing.local);
  const serverTime = Number(timing.serverTime);
  const receivedAt = Number(timing.receivedAt);
  data.previousTarget.copy(data.target);
  data.target.set(Number(player.position.x) || 0, Number(player.position.y) || 0, Number(player.position.z) || 0);
  if (!local && Number.isFinite(serverTime)) {
    data.interpolation.push(player.position, serverTime, Number.isFinite(receivedAt) ? receivedAt : 0);
    data.latestServerTime = serverTime;
    data.latestReceivedAt = Number.isFinite(receivedAt) ? receivedAt : 0;
  } else if (local) data.interpolation.clear();
  data.mass = Math.max(0.2, Number(player.mass) || 1);
  data.score = Math.max(0, Number(player.score) || 0);
  data.deaths = Math.max(0, Number(player.deaths) || 0);
  const previousSkinId = data.skinId;
  data.skinId = typeof player.skinId === 'string' ? player.skinId : '';
  if (data.skinId !== previousSkinId) applyFishAppearance(rig, data.theme);
  applyEvolutionSilhouette(rig, data.mass);
}

export function animateFishRig(rig, time, local = false, deltaSeconds = 1 / 60) {
  const data = rig.userData;
  if (!local && data.interpolation.size) {
    const sampled = data.interpolation.sample(renderServerTime({
      latestServerTime: data.latestServerTime,
      latestReceivedAt: data.latestReceivedAt,
      now: time,
    }));
    if (sampled) data.target.set(sampled.x, sampled.y, sampled.z);
  }
  rig.position.lerp(data.target, frameIndependentAlpha(local ? 16.5 : 10.5, deltaSeconds));
  const size = Math.cbrt(Math.max(0.2, data.mass));
  TARGET_SCALE.set(size, size, size);
  rig.scale.lerp(TARGET_SCALE, frameIndependentAlpha(7, deltaSeconds));

  MOVE.subVectors(data.target, rig.position);
  const speed = Math.min(1, MOVE.length() / 2.2);
  data.lastSpeed += (speed - data.lastSpeed) * frameIndependentAlpha(12, deltaSeconds);
  if (MOVE.lengthSq() > 0.00008) {
    MOVE.normalize();
    const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(X_AXIS, MOVE);
    rig.quaternion.slerp(targetQuaternion, frameIndependentAlpha(12, deltaSeconds));
  }

  const seconds = time * 0.001;
  const swim = 4.5 + data.lastSpeed * 8.5;
  const amplitude = 0.16 + data.lastSpeed * 0.34;
  data.tailPivot.rotation.y = Math.sin(seconds * swim) * amplitude;
  data.pectoralPivots[0].rotation.x = Math.sin(seconds * swim * 0.58) * 0.18 - 0.15;
  data.pectoralPivots[1].rotation.x = -Math.sin(seconds * swim * 0.58) * 0.18 + 0.15;
  data.dorsal.rotation.x = Math.sin(seconds * 1.4) * 0.035;
  data.ventral.rotation.x = -Math.sin(seconds * 1.1) * 0.03;
  data.biolumeMaterial.opacity = data.isLocal ? 0.25 + Math.sin(seconds * 2.35) * 0.065 : 0;
  data.glowMaterial.opacity = data.isLocal ? 0.014 + Math.sin(seconds * 2.2) * 0.004 : 0;
}

export function applyFishTheme(rig, theme) {
  rig.userData.theme = theme;
  applyFishAppearance(rig, theme);
}

export function disposeFishRig(rig) {
  const data = rig?.userData;
  if (!data) return;
  const materials = new Set([
    data.bodyMaterial,
    data.finMaterial,
    data.eyeMaterial,
    data.pupilMaterial,
    data.mouthMaterial,
    data.glowMaterial,
  ]);
  for (const material of materials) material?.dispose?.();
  data.biolumeMaterial?.dispose?.();
  data.glowGeometry?.dispose?.();
}

export function createFoodMesh(theme) {
  const material = new THREE.MeshStandardMaterial({
    color: theme.food.color,
    emissive: theme.food.emissive,
    emissiveIntensity: theme.food.emissiveIntensity,
    roughness: 0.22,
    metalness: 0.04,
  });
  const group = new THREE.Group();
  group.name = 'lantern-plankton';

  const body = new THREE.Mesh(FOOD_BODY_GEOMETRY, material);
  body.scale.set(1.35, 0.82, 0.82);
  group.add(body);

  const core = new THREE.Mesh(FOOD_CORE_GEOMETRY, material);
  core.position.x = 0.23;
  core.scale.setScalar(0.76);
  group.add(core);

  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(FOOD_FIN_GEOMETRY, material);
    fin.position.set(-0.12, 0, side * 0.3);
    fin.rotation.x = side * Math.PI / 2;
    fin.rotation.z = -Math.PI / 2;
    fin.scale.set(0.72, 0.86, 0.35);
    group.add(fin);
  }

  for (let index = 0; index < 3; index += 1) {
    const tendril = new THREE.Mesh(FOOD_TENDRIL_GEOMETRY, material);
    tendril.position.set(-0.28 - index * 0.045, -0.2 + index * 0.18, (index - 1) * 0.12);
    tendril.rotation.z = Math.PI / 2.8;
    group.add(tendril);
  }

  group.userData.foodMaterial = material;
  return group;
}

export function applyFoodTheme(mesh, theme) {
  const material = mesh?.userData?.foodMaterial;
  if (!material) return;
  material.color.setHex(theme.food.color);
  material.emissive.setHex(theme.food.emissive);
  material.emissiveIntensity = theme.food.emissiveIntensity;
}
