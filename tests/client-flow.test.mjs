import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('client exposes explicit responsive connection and respawn states', async () => {
  const [html, css, integration, app] = await Promise.all([
    readFile('public/index.html', 'utf8'),
    readFile('public/styles.css', 'utf8'),
    readFile('public/integration.css', 'utf8'),
    readFile('public/app.js', 'utf8'),
  ]);

  for (const marker of ['id="connection-banner"', 'id="respawn-card"', 'role="status"', 'aria-live="polite"']) {
    assert.ok(html.includes(marker), `missing flow HTML marker: ${marker}`);
  }
  for (const state of ['ready', 'connecting', 'online', 'reconnecting', 'upgrade-required', 'offline']) {
    assert.ok(app.includes(`'${state}'`), `missing connection state: ${state}`);
  }
  assert.ok((css + integration).includes('env(safe-area-inset-bottom)'), 'mobile controls must respect bottom safe area');
});

test('gameplay keyboard input ignores menus and native form controls', async () => {
  const [input, app, lobby] = await Promise.all([
    readFile('public/game/input.js', 'utf8'),
    readFile('public/app.js', 'utf8'),
    readFile('public/ui/lobby.js', 'utf8'),
  ]);
  for (const marker of [
    "input, select, button, textarea, a, [role=\"button\"], [data-no-steer]",
    'isInteractiveTarget(event.target)',
  ]) {
    assert.ok(input.includes(marker), `missing input guard: ${marker}`);
  }
  assert.ok(app.includes('input?.setEnabled(false)'), 'settings opening must disable gameplay input');
  assert.ok(app.includes('document.exitPointerLock'), 'settings opening must release pointer lock');
  assert.ok(lobby.includes('onSettingsOpen()'), 'lobby must notify the app when settings open');
});
