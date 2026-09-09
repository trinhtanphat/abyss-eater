import test from 'node:test';
import assert from 'node:assert/strict';
import { createModerationReport } from '../src/profile-store.mjs';
import { readFile } from 'node:fs/promises';

test('moderation report stores only bounded canonical metadata', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          return { run: async () => ({ success: true, meta: { changes: 1 } }) };
        },
      };
    },
  };
  const result = await createModerationReport(db, 'reporter-1', {
    targetPlayerId: 'target-2', room: '  OCEAN-7  ', reason: 'spam',
  }, 1234, 'report-1');
  assert.deepEqual(result, { ok: true, id: 'report-1' });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ['report-1', 'reporter-1', 'target-2', 'ocean-7', 'spam', 1234]);
});
test('moderation report rejects unknown reason and overlong target before mutation', async () => {
  let prepared = 0;
  const db = { prepare() { prepared += 1; throw new Error('should-not-run'); } };
  await assert.rejects(
    () => createModerationReport(db, 'reporter-1', { targetPlayerId: 'x'.repeat(129), reason: 'spam' }, 1, 'r'),
    /report-target-invalid/,
  );
  await assert.rejects(
    () => createModerationReport(db, 'reporter-1', { targetPlayerId: 'target', reason: 'raw-message' }, 1, 'r'),
    /report-reason-invalid/,
  );
  assert.equal(prepared, 0);
});

test('migration and Worker expose authenticated report path without raw chat storage', async () => {
  const migration = await readFile('migrations/0003_moderation_reports.sql', 'utf8');
  const worker = await readFile('src/worker.template.mjs', 'utf8');
  assert.match(migration, /CREATE TABLE moderation_reports/);
  assert.equal(migration.includes('chat_text'), false);
  assert.match(worker, /handleReportApi/);
  assert.match(worker, /url\.pathname === '\/api\/report'/);
  assert.match(worker, /authenticatedProfile/);
});