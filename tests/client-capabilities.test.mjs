import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCapabilities } from '../src/client-capabilities.mjs';

test('capability classification fails closed without WebGL', () => {
  assert.deepEqual(classifyCapabilities({ webgl: false, modules: true, serviceWorker: true }), {
    playable: false,
    reason: 'webgl_unavailable',
    serviceWorker: true,
  });
});

test('capability classification fails closed without module support', () => {
  assert.deepEqual(classifyCapabilities({ webgl: true, modules: false, serviceWorker: true }), {
    playable: false,
    reason: 'modules_unavailable',
    serviceWorker: true,
  });
});

test('service worker support is optional for gameplay', () => {
  assert.deepEqual(classifyCapabilities({ webgl: true, modules: true, serviceWorker: false }), {
    playable: true,
    reason: null,
    serviceWorker: false,
  });
});
