import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';
import { WORLD_VISUAL_RADIUS } from './config.js';
import { biomeVisual } from './biomes.js';

function seeded(index, salt = 0) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function scatterXZ(index, radius, salt = 0) {
  const angle = seeded(index, salt) * Math.PI * 2;
  const distance = Math.sqrt(seeded(index, salt + 1)) * radius;
  return [Math.cos(angle) * distance, Math.sin(angle) * distance];
}

function createPointCloud(count, radius, yMin, yMax, color, size, opacity) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const [x, z] = scatterXZ(i, radius, 31);
    positions[i * 3] = x;
    positions[i * 3 + 1] = yMin + seeded(i, 42) * (yMax - yMin);
    positions[i * 3 + 2] = z;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false });
  return new THREE.Points(geometry, material);
}

function createInstancedDecor(geometry, material, count, radius, y, scaleRange, salt) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();
  for (let i = 0; i < count; i += 1) {
    const [x, z] = scatterXZ(i, radius, salt);
    const s = scaleRange[0] + seeded(i, salt + 3) * (scaleRange[1] - scaleRange[0]);
    position.set(x, y + seeded(i, salt + 4) * 1.8, z);
    euler.set(0, seeded(i, salt + 5) * Math.PI * 2, 0);
    quaternion.setFromEuler(euler);
    scale.set(s * (0.75 + seeded(i, salt + 6) * 0.5), s, s * (0.75 + seeded(i, salt + 7) * 0.5));
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function createOceanEnvironment(scene, { theme, profile }) {
  let activeTheme = theme;
  let activeBiome = biomeVisual('reef');
  const root = new THREE.Group();
  root.name = 'ocean-environment';
  scene.add(root);

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: theme.floor.color,
    roughness: theme.floor.roughness,
    metalness: 0,
    emissive: theme.floor.emissive,
    emissiveIntensity: theme.floor.emissiveIntensity,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(145, 72), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -29.5;
  root.add(floor);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: theme.water.shaft,
    transparent: true,
    opacity: theme.atmosphere.ringOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(92, 140, 72), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -29.35;
  root.add(ring);

  const rockMaterial = new THREE.MeshStandardMaterial({ color: theme.decor.rock, roughness: 0.96 });
  const kelpMaterial = new THREE.MeshStandardMaterial({ color: theme.decor.kelp, roughness: 0.72, side: THREE.DoubleSide });
  const coralMaterial = new THREE.MeshStandardMaterial({ color: theme.decor.coral, roughness: 0.64, emissive: theme.decor.coral, emissiveIntensity: 0.08 });
  const coralAltMaterial = new THREE.MeshStandardMaterial({ color: theme.decor.coralAlt, roughness: 0.67, emissive: theme.decor.coralAlt, emissiveIntensity: 0.06 });

  const rocks = createInstancedDecor(new THREE.DodecahedronGeometry(1.3, 0), rockMaterial, profile.rocks, WORLD_VISUAL_RADIUS, -28.2, [0.7, 2.5], 7);
  root.add(rocks);

  const kelpGeometry = new THREE.ConeGeometry(0.34, 4.6, 6, 1, true);
  kelpGeometry.translate(0, 2.3, 0);
  const kelp = createInstancedDecor(kelpGeometry, kelpMaterial, profile.kelp, WORLD_VISUAL_RADIUS * 0.92, -29.1, [0.65, 1.75], 13);
  root.add(kelp);

  const coralGeometry = new THREE.TorusKnotGeometry(0.5, 0.13, 36, 6, 2, 3);
  const coral = createInstancedDecor(coralGeometry, coralMaterial, Math.ceil(profile.coral * 0.55), WORLD_VISUAL_RADIUS * 0.86, -27.8, [0.65, 1.45], 17);
  const coralAlt = createInstancedDecor(new THREE.OctahedronGeometry(0.72, 0), coralAltMaterial, Math.floor(profile.coral * 0.45), WORLD_VISUAL_RADIUS * 0.9, -27.9, [0.55, 1.3], 23);
  root.add(coral, coralAlt);

  const bubbles = createPointCloud(profile.bubbles, WORLD_VISUAL_RADIUS, -27, 29, theme.water.bubble, theme.atmosphere.bubbleSize, theme.atmosphere.bubbleOpacity);
  const plankton = createPointCloud(profile.plankton, WORLD_VISUAL_RADIUS, -27, 29, theme.water.plankton, theme.atmosphere.planktonSize, theme.atmosphere.planktonOpacity);
  root.add(bubbles, plankton);

  const shafts = new THREE.Group();
  const shaftGeometry = new THREE.ConeGeometry(4.6, 58, 18, 1, true);
  const shaftMaterial = new THREE.MeshBasicMaterial({
    color: theme.water.shaft,
    transparent: true,
    opacity: theme.atmosphere.shaftOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < profile.shafts; i += 1) {
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    const [x, z] = scatterXZ(i, 68, 53);
    shaft.position.set(x, 17, z);
    shaft.rotation.z = (seeded(i, 54) - 0.5) * 0.16;
    shaft.userData.baseScaleX = 0.55 + seeded(i, 55) * 0.7;
    shaft.scale.x = shaft.userData.baseScaleX * theme.atmosphere.shaftWidth;
    shafts.add(shaft);
  }
  root.add(shafts);

  function applyBiome(id) {
    activeBiome = biomeVisual(id);
    if (scene.fog) scene.fog.density = activeTheme.scene.fogDensity * activeBiome.fogScale;
    ringMaterial.opacity = activeTheme.atmosphere.ringOpacity * activeBiome.ambientScale;
    bubbles.material.opacity = activeTheme.atmosphere.bubbleOpacity * activeBiome.ambientScale;
    plankton.material.opacity = activeTheme.atmosphere.planktonOpacity * activeBiome.ambientScale;
    shaftMaterial.opacity = activeTheme.atmosphere.shaftOpacity * activeBiome.ambientScale;
    return activeBiome;
  }

  function applyTheme(nextTheme) {
    activeTheme = nextTheme;
    floorMaterial.color.setHex(nextTheme.floor.color);
    floorMaterial.roughness = nextTheme.floor.roughness;
    floorMaterial.emissive.setHex(nextTheme.floor.emissive);
    floorMaterial.emissiveIntensity = nextTheme.floor.emissiveIntensity;
    ringMaterial.color.setHex(nextTheme.water.shaft);
    rockMaterial.color.setHex(nextTheme.decor.rock);
    kelpMaterial.color.setHex(nextTheme.decor.kelp);
    coralMaterial.color.setHex(nextTheme.decor.coral);
    coralMaterial.emissive.setHex(nextTheme.decor.coral);
    coralMaterial.emissiveIntensity = nextTheme.id === 'deep-sea' ? 0.015 : 0.08;
    coralAltMaterial.color.setHex(nextTheme.decor.coralAlt);
    coralAltMaterial.emissive.setHex(nextTheme.decor.coralAlt);
    coralAltMaterial.emissiveIntensity = nextTheme.id === 'deep-sea' ? 0.012 : 0.06;
    bubbles.material.color.setHex(nextTheme.water.bubble);
    bubbles.material.size = nextTheme.atmosphere.bubbleSize;
    plankton.material.color.setHex(nextTheme.water.plankton);
    plankton.material.size = nextTheme.atmosphere.planktonSize;
    shaftMaterial.color.setHex(nextTheme.water.shaft);
    for (const shaft of shafts.children) shaft.scale.x = shaft.userData.baseScaleX * nextTheme.atmosphere.shaftWidth;
    applyBiome(activeBiome.id);
  }

  function update(time) {
    const seconds = time * 0.001;
    const atmosphere = activeTheme.atmosphere;
    bubbles.rotation.y = seconds * atmosphere.drift;
    bubbles.position.y = Math.sin(seconds * 0.45) * 0.65 * atmosphere.sway;
    plankton.rotation.y = -seconds * atmosphere.drift * 0.5;
    plankton.rotation.z = Math.sin(seconds * 0.08) * 0.02 * atmosphere.sway;
    shafts.rotation.y = Math.sin(seconds * 0.05) * 0.08 * atmosphere.sway;
    kelp.rotation.y = Math.sin(seconds * 0.22) * 0.006 * atmosphere.sway;
  }

  function dispose() {
    root.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
    scene.remove(root);
  }

  return { root, update, applyTheme, applyBiome, dispose };
}
