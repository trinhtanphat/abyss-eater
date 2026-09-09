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
