import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

test('Carrier 5 keeps hot server paths timer-free and GitHub CI-only', () => {
  for (const file of filesUnder('src')) {
    const source = readFileSync(file, 'utf8');
    assert.equal(source.includes('setInterval('), false, `perpetual interval forbidden: ${file}`);
  }
  assert.equal(existsSync('.github/workflows/deploy-production.yml'), false);
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  for (const forbidden of ['wrangler deploy', 'CLOUDFLARE_API_TOKEN', 'd1 migrations apply']) {
    assert.equal(ci.includes(forbidden), false, `CI must stay validation-only: ${forbidden}`);
  }
});

test('Carrier 5 browser has no profile authority or raw HTML chat rendering', () => {
  const social = readFileSync('public/client-social.mjs', 'utf8');
  const app = readFileSync('public/app.js', 'utf8');
  assert.equal(social.includes('profileId:'), false);
  assert.equal(social.includes('innerHTML'), false);
  assert.match(app, /text\.textContent/);
  assert.match(app, /toggleMutedId/);
});
test('Carrier 5 Worker and Wrangler expose exactly the three V1 Durable Object roles', () => {
  const worker = readFileSync('src/worker.template.mjs', 'utf8');
  for (const className of ['GameRoom', 'Matchmaker', 'Party']) {
    assert.match(worker, new RegExp(`export class ${className} extends DurableObject`));
  }
  const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  const bindings = Object.fromEntries(wrangler.durable_objects.bindings.map((binding) => [binding.name, binding.class_name]));
  assert.deepEqual(bindings, { GAME_ROOM: 'GameRoom', MATCHMAKER: 'Matchmaker', PARTY: 'Party' });
});

test('Carrier 5 stores reports without raw chat or credentials', () => {
  const migration = readFileSync('migrations/0003_moderation_reports.sql', 'utf8');
  const store = readFileSync('src/profile-store.mjs', 'utf8');
  for (const forbidden of ['chat_text', 'session_token', 'authorization']) {
    assert.equal(migration.toLowerCase().includes(forbidden), false);
  }
  assert.match(store, /reported_player_id/);
  assert.match(store, /reason/);
});