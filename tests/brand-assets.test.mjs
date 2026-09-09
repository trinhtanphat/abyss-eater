import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const ASSETS = [
  '/assets/brand/abyss-eater-mark.svg',
  '/assets/ui/icons/mass.svg',
  '/assets/ui/icons/crown.svg',
  '/assets/ui/icons/skull.svg',
  '/assets/ui/icons/jaw.svg',
  '/assets/ui/icons/evolution.svg',
  '/assets/ui/icons/depth.svg',
  '/assets/ui/icons/settings.svg',
];

test('brand and HUD SVG asset pack exists as same-origin files', () => {
  for (const asset of ASSETS) {
    assert.equal(existsSync(`public${asset}`), true, `${asset} must exist`);
  }
});

test('SVG assets stay dependency-free and compact', async () => {
  for (const asset of ASSETS) {
    const source = await readFile(`public${asset}`, 'utf8');
    assert.match(source, /<svg\b/);
    assert.ok(!/<script\b/i.test(source), `${asset} must not contain scripts`);
    assert.ok(!/<image\b/i.test(source), `${asset} must not embed raster images`);
    assert.ok(!/\b(?:href|src)=["']https?:\/\//i.test(source), `${asset} must not require external resources`);
    assert.ok(source.length < 5000, `${asset} must stay lightweight`);
  }
});

test('lobby and HUD markup use the new asset family without changing metric ids', async () => {
  const html = await readFile('public/index.html', 'utf8');
  for (const asset of ASSETS) assert.ok(html.includes(asset), `index must reference ${asset}`);
  for (const id of ['hud-mass', 'hud-score', 'hud-rank', 'hud-players', 'hud-ping', 'growth-progress', 'depth-meter', 'settings-button']) {
    assert.ok(html.includes(`id=\"${id}\"`), `${id} must remain stable`);
  }
  assert.ok(html.includes('class="hud-brand-mark'));
  assert.ok(html.includes('class="metric-icon'));
});

test('HUD icon styles remain compact and service worker precaches all visual assets', async () => {
  const css = await readFile('public/hud-assets.css', 'utf8');
  const themes = await readFile('public/themes.css', 'utf8');
  const sw = await readFile('public/sw.js', 'utf8');
  assert.ok(css.includes('.metric-icon'));
  assert.ok(css.includes('.hud-brand-mark'));
  assert.ok(themes.includes("@import url('/hud-assets.css')"), 'theme shell must load the dedicated HUD asset stylesheet');
  for (const asset of ASSETS) assert.ok(sw.includes(`'${asset}'`), `service worker must precache ${asset}`);
});
