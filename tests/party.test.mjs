import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PARTY_MEMBERS,
  canonicalInviteCode,
  createPartyState,
  joinPartyState,
  leavePartyState,
  publicPartyState,
} from '../src/party.mjs';

const member = (id, name = id) => ({ profileId: id, displayName: name });

test('party invite codes and initial leader are bounded', () => {
  assert.equal(MAX_PARTY_MEMBERS, 4);
  assert.equal(canonicalInviteCode(' abcd23 '), 'ABCD23');
  assert.equal(canonicalInviteCode('bad-code'), '');
  const state = createPartyState('ABC234', member('p1', 'One'), 100);
  assert.equal(state.code, 'ABC234');
  assert.equal(state.leaderId, 'p1');
  assert.deepEqual(state.members.map((m) => m.profileId), ['p1']);
});

test('party join is unique and hard capped at four members', () => {
  let state = createPartyState('ABC234', member('p1'), 100);
  for (const id of ['p2', 'p3', 'p4']) state = joinPartyState(state, member(id), 200).state;
  assert.equal(state.members.length, 4);
  assert.equal(joinPartyState(state, member('p4'), 300).code, 'already_member');
  assert.equal(joinPartyState(state, member('p5'), 300).code, 'party_full');
});
test('leader leave promotes the oldest remaining member and empty party closes', () => {
  let state = createPartyState('ABC234', member('p1'), 100);
  state = joinPartyState(state, member('p2'), 200).state;
  state = joinPartyState(state, member('p3'), 300).state;
  const left = leavePartyState(state, 'p1', 400);
  assert.equal(left.ok, true);
  assert.equal(left.state.leaderId, 'p2');
  assert.deepEqual(left.state.members.map((m) => m.profileId), ['p2', 'p3']);

  const second = leavePartyState(left.state, 'p2', 500).state;
  const last = leavePartyState(second, 'p3', 600);
  assert.equal(last.ok, true);
  assert.equal(last.state, null);
});


test('public party state hides persistent profile identifiers', () => {
  let state = createPartyState('ABC234', member('p1', 'Leader'), 100);
  state = joinPartyState(state, member('p2', 'Friend'), 200).state;
  state = { ...state, room: 'public-sea-1' };
  assert.deepEqual(publicPartyState(state, 'p1'), {
    code: 'ABC234',
    room: 'public-sea-1',
    memberCount: 2,
    members: [{ displayName: 'Leader' }, { displayName: 'Friend' }],
    isLeader: true,
  });
  assert.equal(JSON.stringify(publicPartyState(state, 'p2')).includes('profileId'), false);
  assert.equal(JSON.stringify(publicPartyState(state, 'p2')).includes('leaderId'), false);
});
