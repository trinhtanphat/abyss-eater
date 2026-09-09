import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';
import { CAMERA, qualityProfile } from './config.js';

export function createGameScene(gameRoot, { theme, quality = 'auto', reducedMotion = false } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, innerWidth / innerHeight, CAMERA.near, CAMERA.far);
  camera.position.set(0, 7, 17);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setSize(innerWidth, innerHeight);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.className = 'game-canvas';
  gameRoot.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.position.set(26, 42, 18);
  const accent = new THREE.PointLight();
  accent.position.set(-18, 8, 12);
  scene.add(hemi, sun, accent);

  let profile = qualityProfile(quality);
  let activeTheme = theme;
  let reduceMotion = Boolean(reducedMotion);
  let impulse = 0;
  const cameraTarget = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const cameraForward = new THREE.Vector3(0, 0, -1);
  const worldUp = new THREE.Vector3(0, 1, 0);

  function applyQuality(nextQuality) {
    profile = qualityProfile(nextQuality);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, profile.dpr));
    return profile;
  }

  function applyTheme(nextTheme) {
    activeTheme = nextTheme;
    scene.background = new THREE.Color(nextTheme.scene.background);
    scene.fog = new THREE.FogExp2(nextTheme.scene.fog, nextTheme.scene.fogDensity);
    hemi.color.setHex(nextTheme.lighting.sky);
    hemi.groundColor.setHex(nextTheme.lighting.ground);
    hemi.intensity = nextTheme.lighting.hemi;
    sun.color.setHex(nextTheme.lighting.sun);
    sun.intensity = nextTheme.lighting.sunIntensity;
    accent.color.setHex(nextTheme.lighting.accent);
    accent.intensity = nextTheme.lighting.accentIntensity;
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, profile.dpr));
  }

  function kickCamera(amount = 0.3) {
    if (reduceMotion) return;
    impulse = Math.min(1.4, Math.max(impulse, amount));
  }

  function setReducedMotion(value) {
    reduceMotion = Boolean(value);
    if (reduceMotion) impulse = 0;
  }

  function follow(target, mass = 1, delta = 1 / 60, look = {}) {
    if (!target) {
      lookTarget.set(0, 0, 0);
      camera.lookAt(lookTarget);
      return;
    }
    const zoom = Math.cbrt(Math.max(1, Number(mass) || 1));
    const yaw = Number(look.yaw) || 0;
    const pitch = Number(look.pitch) || 0;
    const cosPitch = Math.cos(pitch);
    cameraForward.set(
      -Math.sin(yaw) * cosPitch,
      Math.sin(pitch),
      -Math.cos(yaw) * cosPitch,
    );
    cameraTarget.copy(target.position || target);
    desiredCamera.copy(cameraTarget)
      .addScaledVector(cameraForward, -13.2 * zoom)
      .addScaledVector(worldUp, 4.2 * zoom);
    const smoothing = 1 - Math.pow(1 - CAMERA.follow, Math.max(1, delta * 60));
    camera.position.lerp(desiredCamera, smoothing);
    if (impulse > 0.001) {
      const strength = impulse * 0.11;
      camera.position.x += Math.sin(performance.now() * 0.045) * strength;
      camera.position.y += Math.cos(performance.now() * 0.051) * strength;
      impulse *= 0.86;
    } else {
      impulse = 0;
    }
    lookTarget.copy(cameraTarget).addScaledVector(cameraForward, 4.5 * zoom);
    camera.lookAt(lookTarget);
  }

  function render() {
    renderer.render(scene, camera);
  }

  addEventListener('resize', resize);
  applyQuality(quality);
  if (theme) applyTheme(theme);

  return {
    THREE,
    scene,
    camera,
    renderer,
    get profile() { return profile; },
    get theme() { return activeTheme; },
    applyQuality,
    applyTheme,
    setReducedMotion,
    kickCamera,
    follow,
    render,
    resize,
    dispose() {
      removeEventListener('resize', resize);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
