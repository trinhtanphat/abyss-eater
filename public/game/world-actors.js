import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';

function materialColor(theme, fallback) {
  return Number(theme?.water?.plankton ?? fallback);
}

function actorPosition(mesh, actor) {
  mesh.position.set(
    Number(actor?.position?.x) || 0,
    Number(actor?.position?.y) || 0,
    Number(actor?.position?.z) || 0,
  );
}

export function createHazardMesh(theme) {
  const group = new THREE.Group();
  group.name = 'world-hazard-jelly';
  const material = new THREE.MeshStandardMaterial({
    color: materialColor(theme, 0x83d8e8),
    emissive: 0x175b73,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.58,
    roughness: 0.32,
    metalness: 0.02,
  });
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.62), material);
  bell.scale.y = 0.72;
  group.add(bell);
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    const tendril = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 1.05, 5), material);
    tendril.position.set(Math.cos(angle) * 0.34, -0.72, Math.sin(angle) * 0.34);
    group.add(tendril);
  }
  group.userData.worldMaterials = [material];
  group.userData.baseRadius = 1;
  return group;
}

export function applyHazardSnapshot(mesh, actor) {
  actorPosition(mesh, actor);
  const radius = Math.max(0.2, Math.min(4, Number(actor?.radius) || 1));
  mesh.scale.setScalar(radius);
  mesh.userData.actorType = 'jelly';
  return mesh;
}

export function createPickupMesh(theme) {
  const group = new THREE.Group();
  group.name = 'world-pickup';
  const currentMaterial = new THREE.MeshStandardMaterial({
    color: Number(theme?.water?.shaft ?? 0x78e7ff),
    emissive: Number(theme?.water?.shaft ?? 0x78e7ff),
    emissiveIntensity: 1.05,
    transparent: true,
    opacity: 0.78,
    roughness: 0.25,
  });
  const pearlMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4fbff,
    emissive: Number(theme?.food?.emissive ?? 0x55d6bc),
    emissiveIntensity: 1.4,
    roughness: 0.18,
  });
  const current = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.12, 8, 24), currentMaterial);
  current.rotation.x = Math.PI / 2;
  current.name = 'current';
  group.add(current);
  const pearls = new THREE.Group();
  pearls.name = 'pearl';
  for (let index = 0; index < 3; index += 1) {
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), pearlMaterial);
    pearl.position.set((index - 1) * 0.28, Math.abs(index - 1) * 0.12, 0);
    pearls.add(pearl);
  }
  pearls.visible = false;
  group.add(pearls);
  group.userData.currentVisual = current;
  group.userData.pearlVisual = pearls;
  group.userData.worldMaterials = [currentMaterial, pearlMaterial];
  return group;
}

export function applyPickupSnapshot(mesh, actor) {
  actorPosition(mesh, actor);
  const radius = Math.max(0.2, Math.min(4, Number(actor?.radius) || 1));
  mesh.scale.setScalar(radius);
  const isPearl = actor?.type === 'pearl';
  if (mesh.userData.currentVisual) mesh.userData.currentVisual.visible = !isPearl;
  if (mesh.userData.pearlVisual) mesh.userData.pearlVisual.visible = isPearl;
  mesh.userData.actorType = isPearl ? 'pearl' : 'current';
  return mesh;
}

export function disposeWorldActorMesh(mesh) {
  const geometries = new Set();
  const materials = new Set();
  mesh?.traverse?.((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
    else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose?.());
  materials.forEach((material) => material.dispose?.());
}