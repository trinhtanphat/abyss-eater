import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('premium client exposes explicit responsive connection, capability and respawn states', async () => {
  const [html, polishCss, polish] = await Promise.all([
    readFile('public/index.html', 'utf8'),
    readFile('public/polish.css', 'utf8'),
    readFile('public/ui/client-polish.js', 'utf8'),
  ]);

  for (const marker of [
    'id="loading-screen"',
    'id="unsupported-screen"',
    'id="connection-banner"',
    'id="respawn-card"',
    'role="status"',
    'aria-live="polite"',
  ]) assert.ok(html.includes(marker), `missing flow HTML marker: ${marker}`);
  for (const state of ['ready', 'connecting', 'online', 'reconnecting', 'upgrade-required', 'offline']) {
    assert.ok(polish.includes(`${state}:`) || polish.includes(`'${state}':`), `missing connection state: ${state}`);
  }
  assert.ok(polishCss.includes('env(safe-area-inset-bottom)'), 'mobile overlays must respect bottom safe area');
});

test('gameplay input ignores open settings and native form controls', async () => {
  const [input, lobby] = await Promise.all([
    readFile('public/game/input.js', 'utf8'),
    readFile('public/ui/lobby.js', 'utf8'),
  ]);
  for (const marker of [
    "document.body.classList.contains('settings-open')",
    'input, select, button, textarea',
    'return { x: 0, y: 0, z: 0 };',
  ]) assert.ok(input.includes(marker), `missing gameplay settings guard: ${marker}`);
  assert.ok(lobby.includes('document.exitPointerLock?.()'), 'opening settings must release pointer lock');
  assert.ok(lobby.includes("document.body.classList.add('settings-open')"));
});
