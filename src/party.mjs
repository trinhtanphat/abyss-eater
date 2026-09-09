export const MAX_PARTY_MEMBERS = 4;
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

function partyProfileId(value) {
  const id = String(value ?? '').trim();
  return /^[A-Za-z0-9._:-]{1,128}$/.test(id) ? id : '';
}

function partyDisplayName(value) {
  const name = String(value ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (name || 'Little Fish').slice(0, 20);
}

export function canonicalInviteCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  return CODE_RE.test(code) ? code : '';
}

export function canonicalPartyMember(value) {
  const profileId = partyProfileId(value?.profileId);
  if (!profileId) return null;
  return { profileId, displayName: partyDisplayName(value?.displayName) };
}
export function createPartyState(code, leader, now = Date.now()) {
  const inviteCode = canonicalInviteCode(code);
  const member = canonicalPartyMember(leader);
  if (!inviteCode || !member) throw new Error('party-create-invalid');
  const timestamp = Number.isFinite(now) ? now : 0;
  return {
    code: inviteCode,
    leaderId: member.profileId,
    members: [{ ...member, joinedAt: timestamp }],
    room: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function joinPartyState(state, rawMember, now = Date.now()) {
  const member = canonicalPartyMember(rawMember);
  if (!state || !member) return { ok: false, code: 'party_invalid', state };
  const members = Array.isArray(state.members) ? state.members : [];
  if (members.some((item) => item.profileId === member.profileId)) {
    return { ok: false, code: 'already_member', state };
  }
  if (members.length >= MAX_PARTY_MEMBERS) return { ok: false, code: 'party_full', state };
  const timestamp = Number.isFinite(now) ? now : 0;
  return {
    ok: true,
    state: { ...state, members: [...members, { ...member, joinedAt: timestamp }], updatedAt: timestamp },
  };
}
export function leavePartyState(state, profileId, now = Date.now()) {
  const id = partyProfileId(profileId);
  const members = Array.isArray(state?.members) ? state.members : [];
  if (!state || !id || !members.some((item) => item.profileId === id)) {
    return { ok: false, code: 'not_member', state };
  }
  const nextMembers = members.filter((item) => item.profileId !== id);
  if (nextMembers.length === 0) return { ok: true, state: null };
  const timestamp = Number.isFinite(now) ? now : 0;
  const nextLeader = state.leaderId === id
    ? [...nextMembers].sort((a, b) => (a.joinedAt - b.joinedAt) || a.profileId.localeCompare(b.profileId))[0].profileId
    : state.leaderId;
  return {
    ok: true,
    state: { ...state, leaderId: nextLeader, members: nextMembers, updatedAt: timestamp },
  };
}

export function publicPartyState(state, viewerProfileId) {
  if (!state || typeof state !== 'object') return null;
  const viewer = partyProfileId(viewerProfileId);
  const members = Array.isArray(state.members) ? state.members.slice(0, MAX_PARTY_MEMBERS) : [];
  return {
    code: canonicalInviteCode(state.code),
    room: String(state.room || '').slice(0, 24),
    memberCount: members.length,
    members: members.map((member) => ({ displayName: partyDisplayName(member?.displayName) })),
    isLeader: Boolean(viewer && state.leaderId === viewer),
  };
}

export function setPartyRoom(state, profileId, room, now = Date.now()) {
  const id = partyProfileId(profileId);
  if (!state || state.leaderId !== id) return { ok: false, code: 'leader_required', state };
  const timestamp = Number.isFinite(now) ? now : 0;
  return { ok: true, state: { ...state, room: String(room || '').slice(0, 24), updatedAt: timestamp } };
}
