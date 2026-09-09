import test from 'node:test';
import assert from 'node:assert/strict';

const protocol = await import('../src/protocol.mjs').catch(() => ({}));

function requireFn(name) {
  assert.equal(typeof protocol[name], 'function', `${name} must be implemented`);
  return protocol[name];
}

test('parseClientMessage accepts only protocol v2 bounded input messages', () => {
  const parseClientMessage = requireFn('parseClientMessage');
  assert.deepEqual(
    parseClientMessage('{"type":"input","v":2,"seq":2,"dir":{"x":1,"y":0,"z":-0.5}}'),
    { ok: true, message: { type: 'input', v: 2, seq: 2, dir: { x: 1, y: 0, z: -0.5 }, boost: false } },
  );
  assert.deepEqual(
    parseClientMessage('{"type":"input","v":1,"seq":2,"dir":{"x":1,"y":0,"z":0}}'),
    { ok: false, code: 'bad_version' },
  );
  assert.deepEqual(
    parseClientMessage('{"type":"input","v":2,"seq":-1,"dir":{"x":1,"y":0,"z":0}}'),
    { ok: false, code: 'bad_seq' },
  );
  assert.deepEqual(
    parseClientMessage('{"type":"input","v":2,"seq":1,"dir":{"x":1,"y":null,"z":0}}'),
    { ok: false, code: 'bad_dir' },
  );
});

test('parseClientMessage validates ping, malformed JSON, unknown types and size', () => {
  const parseClientMessage = requireFn('parseClientMessage');
  assert.deepEqual(parseClientMessage('{"type":"ping","v":2,"t":123.5}'), {
    ok: true,
    message: { type: 'ping', v: 2, t: 123.5 },
  });
  assert.deepEqual(parseClientMessage('{'), { ok: false, code: 'bad_json' });
  assert.deepEqual(parseClientMessage('{"type":"chat","v":2}'), { ok: false, code: 'bad_type' });
  assert.deepEqual(parseClientMessage('x'.repeat(1025)), { ok: false, code: 'bad_message' });
  assert.deepEqual(parseClientMessage(new Uint8Array([1, 2, 3])), { ok: false, code: 'bad_message' });
  assert.deepEqual(parseClientMessage('{"type":"ping","v":2,"t":"123"}'), { ok: false, code: 'bad_ping' });
});

test('acceptSequence requires a strictly increasing safe sequence', () => {
  const acceptSequence = requireFn('acceptSequence');
  assert.equal(acceptSequence(5, 6), true);
  assert.equal(acceptSequence(5, 5), false);
  assert.equal(acceptSequence(5, 4), false);
  assert.equal(acceptSequence(5, Number.MAX_SAFE_INTEGER + 1), false);
});

test('consumeRateWindow rejects the 26th message and resets after one second', () => {
  const consumeRateWindow = requireFn('consumeRateWindow');
  let state;
  for (let i = 1; i <= 25; i += 1) {
    const result = consumeRateWindow(state, 1000 + i, 25, 1000);
    state = result.state;
    assert.equal(result.allowed, true, `message ${i} should be allowed`);
  }
  const rejected = consumeRateWindow(state, 1100, 25, 1000);
  assert.equal(rejected.allowed, false);
  const reset = consumeRateWindow(rejected.state, 2101, 25, 1000);
  assert.equal(reset.allowed, true);
  assert.deepEqual(reset.state, { startedAt: 2101, count: 1 });
});
