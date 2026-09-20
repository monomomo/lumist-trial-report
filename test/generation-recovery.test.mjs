import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORM_DRAFT_TTL_MS,
  GENERATION_CHECKPOINT_TTL_MS,
  createExpiringRecord,
  readFreshRecord,
  createGenerationFingerprint,
  normalizeGeneratedStages,
  getPendingStageIndexes,
  countCompletedStages,
} from '../public/report/generation-recovery.js';

test('recovery records expire at their configured deadline', () => {
  const now = 1_000;
  const record = createExpiringRecord({ studentName: 'Chloe' }, now, FORM_DRAFT_TTL_MS);
  assert.deepEqual(readFreshRecord(JSON.stringify(record), now + FORM_DRAFT_TTL_MS - 1)?.payload, { studentName: 'Chloe' });
  assert.equal(readFreshRecord(JSON.stringify(record), now + FORM_DRAFT_TTL_MS), null);
  assert.equal(GENERATION_CHECKPOINT_TTL_MS, 24 * 60 * 60 * 1000);
});

test('invalid recovery records are ignored', () => {
  assert.equal(readFreshRecord('<html>', Date.now()), null);
  assert.equal(readFreshRecord(JSON.stringify({ version: 99, expiresAt: Date.now() + 10, payload: {} }), Date.now()), null);
  assert.equal(readFreshRecord(JSON.stringify({ version: 1, expiresAt: Date.now() + 10 }), Date.now()), null);
});

test('generation fingerprints are stable across object key order and change with input', () => {
  const first = createGenerationFingerprint({ studentName: 'Chloe', nested: { hours: 32, focus: ['foundation'] } });
  const reordered = createGenerationFingerprint({ nested: { focus: ['foundation'], hours: 32 }, studentName: 'Chloe' });
  const changed = createGenerationFingerprint({ studentName: 'Chloe', nested: { hours: 33, focus: ['foundation'] } });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test('only valid completed stages are resumed', () => {
  const generatedStages = normalizeGeneratedStages([
    { title: '阶段一', lessons: [{ theme: '基础' }] },
    null,
    { title: '阶段三', lessons: [] },
    { title: '阶段四', lessons: [{ theme: '模考' }] },
  ], 4);
  assert.equal(countCompletedStages(generatedStages), 2);
  assert.deepEqual(getPendingStageIndexes(generatedStages), [1, 2]);
});
