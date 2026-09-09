import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Worker exposes Matchmaker and Party Durable Objects with bounded social routes', async () => {
  const worker = await readFile('src/worker.template.mjs', 'utf8');
  for (const marker of [
    'export class Matchmaker extends DurableObject',
    'export class Party extends DurableObject',
    "'/api/matchmaking/quick'",
    "'/api/party/create'",
    "'/api/party/join'",
    "'/api/party/leave'",
    "'/api/party/status'",
    "'/api/party/quick'",
  ]) assert.ok(worker.includes(marker), `missing social Worker marker: ${marker}`);
  assert.equal(worker.includes('setInterval('), false);
});

test('Wrangler binds Matchmaker and Party and adds them in a forward migration', async () => {
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  const bindings = Object.fromEntries(config.durable_objects.bindings.map((item) => [item.name, item.class_name]));
  assert.equal(bindings.GAME_ROOM, 'GameRoom');
  assert.equal(bindings.MATCHMAKER, 'Matchmaker');
  assert.equal(bindings.PARTY, 'Party');
  const migration = config.migrations.find((item) => item.tag === 'v2');
  assert.deepEqual(migration?.new_sqlite_classes, ['Matchmaker', 'Party']);
});
test('build embeds social helpers and production renderer preserves all DO bindings', async () => {
  const build = await readFile('scripts/build.mjs', 'utf8');
  assert.match(build, /src\/matchmaking\.mjs/);
  assert.match(build, /src\/party\.mjs/);
  assert.match(build, /\/\*__MATCHMAKING__\*\//);
  assert.match(build, /\/\*__PARTY__\*\//);

  const renderer = await readFile('scripts/render-production-wrangler.mjs', 'utf8');
  assert.equal(renderer.includes('durable_objects ='), false, 'renderer must preserve source Durable Object bindings');
});
test('public Quick Dive rooms send bounded occupancy heartbeats only on join and detach', async () => {
  const worker = await readFile('src/worker.template.mjs', 'utf8');
  assert.match(worker, /notifyMatchmakerOccupancy/);
  assert.match(worker, /matchRoom/);
  assert.match(worker, /'\/heartbeat'/);
  assert.match(worker, /await this\.notifyMatchmakerOccupancy\(player\.matchRoom/);
  assert.equal(worker.includes('setInterval('), false);
});
