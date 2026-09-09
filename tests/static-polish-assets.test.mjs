import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const MODULES = ['client-settings.mjs', 'client-audio.mjs', 'client-capabilities.mjs'];

test('branded static runtime modules match their tested source counterparts', async () => {
  for (const name of MODULES) {
    const [source, runtime] = await Promise.all([
      readFile(`src/${name}`, 'utf8'),
      readFile(`public/${name}`, 'utf8'),
    ]);
    assert.equal(runtime, source, `${name} public runtime copy must match source`);
  }
});

test('service worker precaches the full capability/settings/audio bootstrap shell', async () => {
  const sw = await readFile('public/sw.js', 'utf8');
  for (const path of ['/bootstrap.js', '/client-settings.mjs', '/client-audio.mjs', '/client-capabilities.mjs']) {
    assert.ok(sw.includes(`'${path}'`), `service worker must precache ${path}`);
  }
});
