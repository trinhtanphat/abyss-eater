import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveGain } from '../src/client-audio.mjs';

test('effectiveGain multiplies bounded master and channel gains', () => {
  assert.equal(effectiveGain(0.5, 0.5), 0.25);
  assert.equal(effectiveGain(2, 2), 1);
  assert.equal(effectiveGain(-1, 0.5), 0);
  assert.equal(effectiveGain(0.5, -1), 0);
});

test('effectiveGain fails silent for non-finite input', () => {
  assert.equal(effectiveGain(Number.NaN, 0.5), 0);
  assert.equal(effectiveGain(0.5, Number.POSITIVE_INFINITY), 0);
});
