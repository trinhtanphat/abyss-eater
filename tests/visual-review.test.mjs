import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('visual review uses a bounded CI render path before taking the screenshot', async () => {
  const [workflow, review] = await Promise.all([
    readFile('.github/workflows/visual-review.yml', 'utf8'),
    readFile('review/abyssal-assets.html', 'utf8'),
  ]);

  assert.ok(workflow.includes('review/abyssal-assets.html?ci=1'), 'CI screenshot must request the bounded review mode');
  assert.ok(review.includes("const ciMode = new URLSearchParams(location.search).get('ci') === '1';"), 'review page must recognize bounded CI mode');
  assert.ok(review.includes('if (!ciMode) setInterval('), 'repeating showcase effects must stay disabled in CI mode');
  assert.ok(review.includes('if (!ciMode || frameCount < 12) requestAnimationFrame(frame);'), 'CI animation loop must terminate after a bounded number of frames');
});

test('visual review triggers for Carrier 4 biome and world presentation changes', async () => {
  const workflow = await readFile('.github/workflows/visual-review.yml', 'utf8');
  for (const path of [
    "public/game/environment.js",
    "public/game/biomes.js",
    "public/game/world-actors.js",
    "public/app.js",
    "public/styles.css",
  ]) {
    assert.ok(workflow.includes(`- '${path}'`), `visual review must watch ${path}`);
  }
});

test('visual review covers Carrier 5 social lobby changes', async () => {
  const workflow = await readFile('.github/workflows/visual-review.yml', 'utf8');
  for (const path of ['public/index.html','public/ui/lobby.js','public/game/network.js','public/client-social.mjs']) {
    assert.ok(workflow.includes(`- '${path}'`), `visual review must watch ${path}`);
  }
  assert.ok(workflow.includes('artifacts/social-lobby.png'));
  assert.ok(workflow.includes('python3 -m http.server 4174 --bind 127.0.0.1 --directory public'));
  assert.ok(workflow.includes('http://127.0.0.1:4174/?visual-review=1'));
});
