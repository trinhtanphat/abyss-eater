import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('client exposes explicit responsive connection and respawn states', async () => {
  const [html, css, app] = await Promise.all([
    readFile('public/index.html', 'utf8'),
    readFile('public/styles.css', 'utf8'),
    readFile('public/app.js', 'utf8'),
  ]);

  for (const marker of ['id="connection-banner"', 'id="respawn-card"', 'role="status"', 'aria-live="polite"']) {
    assert.ok(html.includes(marker), `missing flow HTML marker: ${marker}`);
  }
  for (const state of ['ready', 'connecting', 'online', 'reconnecting', 'upgrade-required', 'offline']) {
    assert.ok(app.includes(`'${state}'`), `missing connection state: ${state}`);
  }
  assert.ok(css.includes('env(safe-area-inset-bottom)'), 'mobile controls must respect bottom safe area');
});

test('gameplay keyboard input ignores open menus and native form controls', async () => {
  const app = await readFile('public/app.js', 'utf8');
  for (const marker of [
    'settingsDialog?.open',
    "event.target?.matches('input, select, button, textarea')",
    'document.exitPointerLock',
  ]) {
    assert.ok(app.includes(marker), `missing keyboard/menu guard: ${marker}`);
  }
});
