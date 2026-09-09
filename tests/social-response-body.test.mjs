import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadSocialDoJson() {
  const source = await readFile('src/worker.template.mjs', 'utf8');
  const match = source.match(/async function socialDoJson\(stub, path, body\) \{[\s\S]*?\n\}/);
  assert.ok(match, 'socialDoJson helper must remain discoverable');
  return Function(`return (${match[0]});`)();
}

test('socialDoJson inspects JSON without consuming the response returned to the caller', async () => {
  const socialDoJson = await loadSocialDoJson();
  const payload = { ok: true, room: 'public-sea-1', region: 'SEA' };
  const stub = {
    async fetch() {
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  };

  const result = await socialDoJson(stub, '/quick', { region: 'SEA', partySize: 1 });
  assert.deepEqual(result.value, payload);
  assert.equal(result.response.bodyUsed, false);
  assert.deepEqual(await result.response.json(), payload);
});
