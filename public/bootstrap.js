import { classifyCapabilities } from '/client-capabilities.mjs';

const root = document.documentElement;
const loadingScreen = document.querySelector('#loading-screen');
const unsupportedScreen = document.querySelector('#unsupported-screen');
const unsupportedTitle = document.querySelector('#unsupported-title');
const unsupportedMessage = document.querySelector('#unsupported-message');
const reloadButton = document.querySelector('#reload-button');

reloadButton?.addEventListener('click', () => location.reload());

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function showUnsupported(reason) {
  root.dataset.appState = 'unsupported';
  loadingScreen?.setAttribute('hidden', '');
  unsupportedScreen?.removeAttribute('hidden');
  if (reason === 'webgl_unavailable') {
    unsupportedTitle.textContent = '3D graphics unavailable';
    unsupportedMessage.textContent = 'Abyss Eater needs WebGL. Enable hardware acceleration or try a current browser and reload.';
    return;
  }
  unsupportedTitle.textContent = 'Game client unavailable';
  unsupportedMessage.textContent = 'This browser could not start the game client. Update or reload the browser and try again.';
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
  } catch {
    // Offline shell support is optional; realtime gameplay must remain usable.
  }
}

const capabilities = classifyCapabilities({
  webgl: hasWebGL(),
  modules: true,
  serviceWorker: 'serviceWorker' in navigator,
});

if (!capabilities.playable) {
  showUnsupported(capabilities.reason);
} else {
  try {
    await import('/app.js');
    root.dataset.appState = 'ready';
    loadingScreen?.setAttribute('hidden', '');
    void registerServiceWorker();
  } catch {
    showUnsupported('client_load_failed');
  }
}
