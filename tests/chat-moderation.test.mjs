import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CHAT_LENGTH,
  normalizeChatText,
  containsProhibitedTerm,
  acceptChatMessage,
} from '../src/chat.mjs';

test('chat text is normalized to bounded plain text', () => {
  assert.equal(MAX_CHAT_LENGTH, 160);
  assert.equal(normalizeChatText('  hello   <b>reef</b>  '), 'hello breef/b');
  assert.equal(normalizeChatText('x'.repeat(220)).length, 160);
  assert.equal(normalizeChatText('\u0000\u0007 hi\nthere'), 'hi there');
});

test('deterministic prohibited-term filtering is case insensitive', () => {
  assert.equal(containsProhibitedTerm('Nice dive'), false);
  assert.equal(containsProhibitedTerm('you are a BITCH'), true);
});
test('chat has an independent rate limit and duplicate suppression window', () => {
  let state = null;
  for (let index = 0; index < 3; index += 1) {
    const result = acceptChatMessage(`message ${index}`, state, 1_000 + index);
    assert.equal(result.ok, true);
    state = result.state;
  }
  const limited = acceptChatMessage('message 4', state, 1_010);
  assert.equal(limited.ok, false);
  assert.equal(limited.code, 'chat_rate_limited');

  const first = acceptChatMessage('same message', null, 20_000);
  const duplicate = acceptChatMessage(' same   message ', first.state, 20_500);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 'chat_duplicate');
  const later = acceptChatMessage('same message', first.state, 29_000);
  assert.equal(later.ok, true);
});

test('empty and prohibited chat is rejected before broadcast', () => {
  assert.equal(acceptChatMessage('   ', null, 0).code, 'chat_empty');
  assert.equal(acceptChatMessage('shit', null, 0).code, 'chat_prohibited');
});
