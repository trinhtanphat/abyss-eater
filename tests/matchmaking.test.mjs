import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGION_IDS,
  regionForCountry,
  canonicalRoomLabel,
  choosePublicRoom,
  PUBLIC_ROOM_CAPACITY,
} from '../src/matchmaking.mjs';

test('coarse region mapping is deterministic and bounded', () => {
  assert.deepEqual(REGION_IDS, ['SEA', 'JP', 'EU', 'NA', 'OTHER']);
  assert.equal(regionForCountry('VN'), 'SEA');
  assert.equal(regionForCountry('JP'), 'JP');
  assert.equal(regionForCountry('DE'), 'EU');
  assert.equal(regionForCountry('US'), 'NA');
  assert.equal(regionForCountry('BR'), 'OTHER');
  assert.equal(regionForCountry(''), 'OTHER');
});

test('private room labels are canonicalized without changing room semantics', () => {
  assert.equal(canonicalRoomLabel('  My   Reef!!  '), 'my reef');
  assert.equal(canonicalRoomLabel(''), 'ocean-1');
  assert.ok(canonicalRoomLabel('x'.repeat(80)).length <= 24);
});
test('Quick Dive selects a fresh same-region room with enough capacity', () => {
  const now = 10_000;
  const records = [
    { room: 'public-sea-a', region: 'SEA', players: 19, updatedAt: now - 100 },
    { room: 'public-sea-b', region: 'SEA', players: 12, updatedAt: now - 200 },
    { room: 'public-jp-a', region: 'JP', players: 2, updatedAt: now - 100 },
    { room: 'public-sea-stale', region: 'SEA', players: 1, updatedAt: now - 120_000 },
  ];
  assert.equal(PUBLIC_ROOM_CAPACITY, 20);
  assert.equal(choosePublicRoom(records, 'SEA', 4, now)?.room, 'public-sea-b');
  assert.equal(choosePublicRoom(records, 'SEA', 9, now), null);
});

test('Quick Dive selection is deterministic when rooms have equal occupancy', () => {
  const now = 20_000;
  const records = [
    { room: 'public-na-z', region: 'NA', players: 4, updatedAt: now - 20 },
    { room: 'public-na-a', region: 'NA', players: 4, updatedAt: now - 30 },
  ];
  assert.equal(choosePublicRoom(records, 'NA', 1, now)?.room, 'public-na-a');
});
