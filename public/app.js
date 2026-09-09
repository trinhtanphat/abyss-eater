import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';
import { cameraRelativeDirection, updateLook } from '/client-input.mjs';

const PROTOCOL_VERSION = 2;
const gameRoot = document.querySelector('#game');
const startScreen = document.querySelector('#start-screen');
const playButton = document.querySelector('#play-button');
const nameInput = document.querySelector('#player-name');
const roomInput = document.querySelector('#room-name');
const hudMass = document.querySelector('#hud-mass');
const hudScore = document.querySelector('#hud-score');
const hudPlayers = document.querySelector('#hud-players');
const hudPing = document.querySelector('#hud-ping');
const hudStatus = document.querySelector('#hud-status');
const hudRoom = document.querySelector('#hud-room');
const toast = document.querySelector('#toast');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x031722);
scene.fog = new THREE.FogExp2(0x031722, 0.014);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 7, 17);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
gameRoot.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x8cecff, 0x001622, 1.25));
const sun = new THREE.DirectionalLight(0xb5f4ff, 1.1);
sun.position.set(25, 45, 15);
scene.add(sun);

const seaFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 220, 28, 28),
  new THREE.MeshStandardMaterial({ color: 0x073145, roughness: 1, metalness: 0, wireframe: true, transparent: true, opacity: 0.13 }),
);
seaFloor.rotation.x = -Math.PI / 2;
seaFloor.position.y = -28;
scene.add(seaFloor);

const bubbleGeometry = new THREE.BufferGeometry();
const bubblePositions = new Float32Array(360 * 3);
for (let i = 0; i < bubblePositions.length; i += 3) {
  bubblePositions[i] = (Math.random() * 2 - 1) * 95;
  bubblePositions[i + 1] = (Math.random() * 2 - 1) * 35;
  bubblePositions[i + 2] = (Math.random() * 2 - 1) * 95;
}
bubbleGeometry.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
const bubbles = new THREE.Points(bubbleGeometry, new THREE.PointsMaterial({ color: 0x80eaff, size: 0.16, transparent: true, opacity: 0.38 }));
scene.add(bubbles);

const fishBodyGeometry = new THREE.SphereGeometry(1, 22, 14);
const fishTailGeometry = new THREE.ConeGeometry(0.8, 1.25, 3);
const fishEyeGeometry = new THREE.SphereGeometry(0.13, 10, 8);
const fishPupilGeometry = new THREE.SphereGeometry(0.06, 8, 6);
const fishEyeMaterial = new THREE.MeshBasicMaterial({ color: 0xeaffff });
const fishPupilMaterial = new THREE.MeshBasicMaterial({ color: 0x021018 });
const foodGeometry = new THREE.IcosahedronGeometry(0.34, 1);
const foodMaterial = new THREE.MeshStandardMaterial({ color: 0x8af8d1, emissive: 0x19a781, emissiveIntensity: 1.7, roughness: 0.25 });

const playerMeshes = new Map();
const foodMeshes = new Map();
const inputKeys = new Set();
const touchState = new Set();
const tmpVector = new THREE.Vector3();
const tmpScale = new THREE.Vector3(1, 1, 1);
const xAxis = new THREE.Vector3(1, 0, 0);
const desiredCamera = new THREE.Vector3();
const cameraForward = new THREE.Vector3(0, 0, -1);
const cameraTarget = new THREE.Vector3();
let socket = null;
let clientId = null;
let snapshot = { players: [], food: [] };
let started = false;
let inputSeq = 0;
let pingSentAt = 0;
let reconnectTimer = null;
let lastToastTimer = null;
let lookYaw = 0;
let lookPitch = -0.12;

function fishColor(id, isLocal) {
  if (isLocal) return 0x64edff;
  let hash = 0;
  for (const ch of id) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return new THREE.Color().setHSL(Math.abs(hash % 360) / 360, 0.68, 0.56);
}

function createFish(id, isLocal = false) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: fishColor(id, isLocal), roughness: 0.46, metalness: 0.05 });
  const body = new THREE.Mesh(fishBodyGeometry, bodyMaterial);
  body.scale.set(1.75, 0.78, 0.72);
  group.add(body);

  const tail = new THREE.Mesh(fishTailGeometry, bodyMaterial);
  tail.rotation.z = -Math.PI / 2;
  tail.position.x = -1.9;
  tail.scale.z = 0.24;
  group.add(tail);

  for (const z of [-0.52, 0.52]) {
    const eye = new THREE.Mesh(fishEyeGeometry, fishEyeMaterial);
    eye.position.set(1.35, 0.22, z);
    group.add(eye);
    const pupil = new THREE.Mesh(fishPupilGeometry, fishPupilMaterial);
    pupil.position.set(1.43, 0.22, z * 1.02);
    group.add(pupil);
  }

  group.userData.target = new THREE.Vector3();
  group.userData.previousTarget = new THREE.Vector3();
  group.userData.mass = 1;
  group.userData.bodyMaterial = bodyMaterial;
  scene.add(group);
  return group;
}

function disposeFishMesh(mesh) {
  scene.remove(mesh);
  mesh.userData.bodyMaterial?.dispose();
}

function createFood() {
  const mesh = new THREE.Mesh(foodGeometry, foodMaterial);
  scene.add(mesh);
  return mesh;
}

function updateSnapshot(next) {
  if (!next || !Array.isArray(next.players)) return;
  const nextFood = Array.isArray(next.food) ? next.food : snapshot.food;
  snapshot = { ...next, food: nextFood };

  const livePlayers = new Set();
  for (const player of snapshot.players) {
    livePlayers.add(player.id);
    let mesh = playerMeshes.get(player.id);
    if (!mesh) {
      mesh = createFish(player.id, player.id === clientId);
      mesh.position.set(player.position.x, player.position.y, player.position.z);
      mesh.userData.target.copy(mesh.position);
      mesh.userData.previousTarget.copy(mesh.position);
      playerMeshes.set(player.id, mesh);
    }
    mesh.userData.previousTarget.copy(mesh.userData.target);
    mesh.userData.target.set(player.position.x, player.position.y, player.position.z);
    mesh.userData.mass = player.mass;
  }
  for (const [id, mesh] of playerMeshes) {
    if (!livePlayers.has(id)) {
      disposeFishMesh(mesh);
      playerMeshes.delete(id);
    }
  }

  const liveFood = new Set();
  for (const food of snapshot.food) {
    liveFood.add(food.id);
    let mesh = foodMeshes.get(food.id);
    if (!mesh) {
      mesh = createFood();
      foodMeshes.set(food.id, mesh);
    }
    mesh.position.set(food.position.x, food.position.y, food.position.z);
  }
  for (const [id, mesh] of foodMeshes) {
    if (!liveFood.has(id)) {
      scene.remove(mesh);
      foodMeshes.delete(id);
    }
  }

  const me = snapshot.players.find((player) => player.id === clientId);
  if (me) {
    hudMass.textContent = Number(me.mass).toFixed(2);
    hudScore.textContent = String(me.score ?? 0);
  }
  hudPlayers.textContent = String(snapshot.players.length);
}

function showToast(message) {
  clearTimeout(lastToastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  lastToastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function setStatus(message, connected = false) {
  hudStatus.textContent = message;
  document.body.classList.toggle('connected', connected);
}

function sanitized(value, fallback, max) {
  return (String(value || '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim() || fallback).slice(0, max);
}

function resumeStorageKey(room) {
  return `abyss-eater-resume:${room}`;
}

function connect() {
  clearTimeout(reconnectTimer);
  const name = sanitized(nameInput.value, 'Little Fish', 20);
  const room = sanitized(roomInput.value, 'ocean-1', 24).toLowerCase();
  const resumeKey = sessionStorage.getItem(resumeStorageKey(room));
  localStorage.setItem('abyss-eater-name', name);
  localStorage.setItem('abyss-eater-room', room);
  hudRoom.textContent = room;
  setStatus('Connecting…');

  const wsUrl = new URL('/ws', location.href);
  wsUrl.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  wsUrl.searchParams.set('name', name);
  wsUrl.searchParams.set('room', room);
  if (resumeKey) wsUrl.searchParams.set('resume', resumeKey);
  socket = new WebSocket(wsUrl);

  socket.addEventListener('open', () => setStatus('Online', true));
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.v !== PROTOCOL_VERSION) {
      showToast('Upgrade required — reload the game');
      socket?.close(1002, 'protocol mismatch');
      return;
    }
    if (message.type === 'welcome') {
      clientId = message.id;
      if (Number.isSafeInteger(message.inputSeq) && message.inputSeq >= 0) inputSeq = message.inputSeq;
      hudRoom.textContent = message.room;
      if (typeof message.resumeKey === 'string' && message.resumeKey) {
        sessionStorage.setItem(resumeStorageKey(room), message.resumeKey);
      }
      updateSnapshot(message.snapshot);
      showToast(message.resumed ? 'Reconnected to your fish' : 'You entered the ocean');
      return;
    }
    if (message.type === 'snapshot') {
      updateSnapshot(message);
      return;
    }
    if (message.type === 'pong') {
      hudPing.textContent = `${Math.max(0, Date.now() - Number(message.t || pingSentAt))} ms`;
      return;
    }
    if (message.type === 'eaten') {
      showToast(`Eaten by ${message.by || 'a bigger fish'} — respawning`);
      return;
    }
    if (message.type === 'error') showToast(`Server rejected input: ${message.code}`);
  });
  socket.addEventListener('close', () => {
    setStatus('Reconnecting…');
    clientId = null;
    if (started) reconnectTimer = setTimeout(connect, 1800);
  });
  socket.addEventListener('error', () => setStatus('Connection issue'));
}

function currentDirection() {
  const axes = { forward: 0, strafe: 0, vertical: 0 };
  if (inputKeys.has('KeyA') || inputKeys.has('ArrowLeft') || touchState.has('left')) axes.strafe -= 1;
  if (inputKeys.has('KeyD') || inputKeys.has('ArrowRight') || touchState.has('right')) axes.strafe += 1;
  if (inputKeys.has('KeyW') || inputKeys.has('ArrowUp') || touchState.has('forward')) axes.forward += 1;
  if (inputKeys.has('KeyS') || inputKeys.has('ArrowDown') || touchState.has('back')) axes.forward -= 1;
  if (inputKeys.has('Space') || touchState.has('up')) axes.vertical += 1;
  if (inputKeys.has('ShiftLeft') || inputKeys.has('ShiftRight') || touchState.has('down')) axes.vertical -= 1;
  return cameraRelativeDirection(axes, lookYaw, lookPitch);
}

function sendInput() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'input', v: PROTOCOL_VERSION, seq: ++inputSeq, dir: currentDirection() }));
}

function ping() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  pingSentAt = Date.now();
  socket.send(JSON.stringify({ type: 'ping', v: PROTOCOL_VERSION, t: pingSentAt }));
}

addEventListener('keydown', (event) => {
  if (!started) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  inputKeys.add(event.code);
});
addEventListener('keyup', (event) => inputKeys.delete(event.code));
addEventListener('blur', () => inputKeys.clear());

renderer.domElement.addEventListener('click', () => {
  if (!started || !matchMedia('(pointer: fine)').matches) return;
  renderer.domElement.requestPointerLock?.();
});

addEventListener('mousemove', (event) => {
  if (!started || document.pointerLockElement !== renderer.domElement) return;
  const nextLook = updateLook({ yaw: lookYaw, pitch: lookPitch }, event.movementX, event.movementY);
  lookYaw = nextLook.yaw;
  lookPitch = nextLook.pitch;
});

document.addEventListener('pointerlockchange', () => {
  if (!started) return;
  if (document.pointerLockElement === renderer.domElement) {
    showToast('Mouse look active · Esc releases cursor');
  } else if (matchMedia('(pointer: fine)').matches) {
    showToast('Mouse released · click the ocean to resume');
  }
});

for (const button of document.querySelectorAll('[data-touch]')) {
  const key = button.dataset.touch;
  const press = (event) => { event.preventDefault(); touchState.add(key); };
  const release = (event) => { event.preventDefault(); touchState.delete(key); };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}

playButton.addEventListener('click', () => {
  started = true;
  document.body.classList.add('playing');
  startScreen.classList.add('hidden');
  connect();
  if (matchMedia('(pointer: fine)').matches) renderer.domElement.requestPointerLock?.();
});

nameInput.value = localStorage.getItem('abyss-eater-name') || nameInput.value;
roomInput.value = localStorage.getItem('abyss-eater-room') || roomInput.value;

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

setInterval(sendInput, 100);
setInterval(ping, 2000);

function animate(time) {
  bubbles.rotation.y = time * 0.000015;
  bubbles.position.y = Math.sin(time * 0.0002) * 1.4;

  for (const mesh of foodMeshes.values()) {
    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.013;
  }

  for (const [id, mesh] of playerMeshes) {
    mesh.position.lerp(mesh.userData.target, id === clientId ? 0.24 : 0.16);
    const scale = Math.cbrt(Math.max(1, mesh.userData.mass));
    tmpScale.set(scale, scale, scale);
    mesh.scale.lerp(tmpScale, 0.12);

    tmpVector.subVectors(mesh.userData.target, mesh.userData.previousTarget);
    if (tmpVector.lengthSq() > 0.0001) {
      tmpVector.normalize();
      const targetQ = new THREE.Quaternion().setFromUnitVectors(xAxis, tmpVector);
      mesh.quaternion.slerp(targetQ, 0.18);
    }
  }

  const localMesh = playerMeshes.get(clientId);
  if (localMesh) {
    const zoom = Math.cbrt(Math.max(1, localMesh.userData.mass));
    const forward = cameraRelativeDirection({ forward: 1, strafe: 0, vertical: 0 }, lookYaw, lookPitch);
    cameraForward.set(forward.x, forward.y, forward.z);
    desiredCamera.copy(localMesh.position)
      .addScaledVector(cameraForward, -13.5 * zoom)
      .addScaledVector(camera.up, 4.2 * zoom);
    camera.position.lerp(desiredCamera, 0.075);
    cameraTarget.copy(localMesh.position).addScaledVector(cameraForward, 4.5 * zoom);
    camera.lookAt(cameraTarget);
  } else {
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});
