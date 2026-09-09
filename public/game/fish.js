import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';

const BODY_GEOMETRY = new THREE.SphereGeometry(1, 26, 18);
const TAIL_GEOMETRY = new THREE.ConeGeometry(0.92, 1.35, 3);
const FIN_GEOMETRY = new THREE.ConeGeometry(0.62, 1.25, 3);
const EYE_GEOMETRY = new THREE.SphereGeometry(0.14, 12, 9);
const PUPIL_GEOMETRY = new THREE.SphereGeometry(0.066, 10, 8);
const MOUTH_GEOMETRY = new THREE.TorusGeometry(0.16, 0.025, 6, 16, Math.PI);
const FOOD_GEOMETRY = new THREE.IcosahedronGeometry(0.34, 1);
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
    emissiveIntensity: isLocal ? 0.9 : 0.5,
    roughness: theme.fish.roughness,
    metalness: theme.fish.metalness,
  });
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

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: theme.fish.eye, roughness: 0.22, emissive: theme.fish.eye, emissiveIntensity: 0.08 });
  const pupilMaterial = new THREE.MeshBasicMaterial({ color: theme.fish.pupil });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(EYE_GEOMETRY, eyeMaterial);
    eye.position.set(1.43, 0.25, side * 0.53);
    const pupil = new THREE.Mesh(PUPIL_GEOMETRY, pupilMaterial);
    pupil.position.set(1.51, 0.25, side * 0.548);
    group.add(eye, pupil);
  }

  const mouthMaterial = new THREE.MeshBasicMaterial({ color: theme.fish.pupil, transparent: true, opacity: 0.8 });
  const mouth = new THREE.Mesh(MOUTH_GEOMETRY, mouthMaterial);
  mouth.position.set(1.72, -0.12, 0);
  mouth.rotation.y = Math.PI / 2;
  mouth.rotation.z = -Math.PI / 2;
  group.add(mouth);

  const glowGeometry = new THREE.SphereGeometry(1.05, 16, 10);
  const glow = new THREE.Mesh(
    glowGeometry,
    new THREE.MeshBasicMaterial({ color: theme.fish.local, transparent: true, opacity: isLocal ? 0.055 : 0, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glow.scale.copy(body.scale).multiplyScalar(1.18);
  group.add(glow);

  group.userData = {
    ...group.userData,
    id,
    isLocal,
    bodyMaterial,
    finMaterial,
    eyeMaterial,
    pupilMaterial,
    mouthMaterial,
    glowGeometry,
    glowMaterial: glow.material,
    tailPivot,
    pectoralPivots,
    dorsal,
    ventral,
    target: new THREE.Vector3(),
    previousTarget: new THREE.Vector3(),
    mass: 1,
    score: 0,
    deaths: 0,
    lastSpeed: 0,
  };
  return group;
}

export function applyFishSnapshot(rig, player) {
  if (!rig || !player?.position) return;
  const data = rig.userData;
  data.previousTarget.copy(data.target);
  data.target.set(Number(player.position.x) || 0, Number(player.position.y) || 0, Number(player.position.z) || 0);
  data.mass = Math.max(1, Number(player.mass) || 1);
  data.score = Math.max(0, Number(player.score) || 0);
  data.deaths = Math.max(0, Number(player.deaths) || 0);
}

export function animateFishRig(rig, time, local = false) {
  const data = rig.userData;
  rig.position.lerp(data.target, local ? 0.24 : 0.16);
  const size = Math.cbrt(Math.max(1, data.mass));
  TARGET_SCALE.set(size, size, size);
  rig.scale.lerp(TARGET_SCALE, 0.11);

  MOVE.subVectors(data.target, data.previousTarget);
  const speed = Math.min(1, MOVE.length() / 2.2);
  data.lastSpeed += (speed - data.lastSpeed) * 0.18;
  if (MOVE.lengthSq() > 0.00008) {
    MOVE.normalize();
    const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(X_AXIS, MOVE);
    rig.quaternion.slerp(targetQuaternion, 0.18);
  }

  const seconds = time * 0.001;
  const swim = 4.5 + data.lastSpeed * 8.5;
  const amplitude = 0.16 + data.lastSpeed * 0.34;
  data.tailPivot.rotation.y = Math.sin(seconds * swim) * amplitude;
  data.pectoralPivots[0].rotation.x = Math.sin(seconds * swim * 0.58) * 0.18 - 0.15;
  data.pectoralPivots[1].rotation.x = -Math.sin(seconds * swim * 0.58) * 0.18 + 0.15;
  data.dorsal.rotation.x = Math.sin(seconds * 1.4) * 0.035;
  data.ventral.rotation.x = -Math.sin(seconds * 1.1) * 0.03;
  data.glowMaterial.opacity = data.isLocal ? 0.045 + Math.sin(seconds * 2.2) * 0.012 : 0;
}

export function applyFishTheme(rig, theme) {
  const data = rig.userData;
  const color = fishBaseColor(data.id, data.isLocal, theme);
  data.bodyMaterial.color.copy(color);
  data.bodyMaterial.emissive.copy(color).multiplyScalar(data.isLocal ? theme.fish.emissiveBoost : theme.fish.emissiveBoost * 0.42);
  data.bodyMaterial.roughness = theme.fish.roughness;
  data.bodyMaterial.metalness = theme.fish.metalness;
  data.finMaterial.color.copy(color);
  data.finMaterial.emissive.copy(data.bodyMaterial.emissive);
  data.finMaterial.roughness = Math.min(1, theme.fish.roughness + 0.12);
  data.finMaterial.metalness = theme.fish.metalness;
  data.eyeMaterial.color.setHex(theme.fish.eye);
  data.eyeMaterial.emissive.setHex(theme.fish.eye);
  data.pupilMaterial.color.setHex(theme.fish.pupil);
  data.mouthMaterial.color.setHex(theme.fish.pupil);
  data.glowMaterial.color.setHex(theme.fish.local);
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
  const mesh = new THREE.Mesh(FOOD_GEOMETRY, material);
  mesh.userData.foodMaterial = material;
  return mesh;
}

export function applyFoodTheme(mesh, theme) {
  const material = mesh?.userData?.foodMaterial;
  if (!material) return;
  material.color.setHex(theme.food.color);
  material.emissive.setHex(theme.food.emissive);
  material.emissiveIntensity = theme.food.emissiveIntensity;
}
