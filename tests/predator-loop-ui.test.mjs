import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('hunt HUD exposes prey and threat counts beside the player scoreboard', async () => {
  const html = await readFile('public/index.html', 'utf8');
  const hud = await readFile('public/ui/hud.js', 'utf8');
  assert.ok(html.includes('id="hud-prey"'));
  assert.ok(html.includes('id="hud-threats"'));
  assert.ok(hud.includes('ecosystemSummary'));
  assert.ok(hud.includes('hud-prey'));
  assert.ok(hud.includes('hud-threats'));
});

test('responsive CSS keeps a compact leaderboard visible on narrow screens', async () => {
  const css = await readFile('public/styles.css', 'utf8');
  assert.ok(css.includes('.leaderboard-card'));
  assert.equal(/\.leaderboard-card\s*\{\s*display:\s*none\s*;?\s*\}/m.test(css), false);
  assert.ok(css.includes('.leaderboard-card .leader-row:nth-child(n+4)'));
});
