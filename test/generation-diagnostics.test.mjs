import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerationDiagnostic } from '../lib/reports/generation-diagnostics.ts';

test('generation diagnostics contain only operational metadata', () => {
  const payload = buildGenerationDiagnostic('request-123', 1000, 'failed', {
    stage: 'quality_validation',
    subjectCode: 'ap_calculus_bc',
    lessonCount: 12,
    issueCount: 2,
    errorCode: 'UNEXPECTED_LANGUAGE',
    errorType: 'Error',
    repairAttempted: true,
  }, 1450);
  assert.deepEqual(payload, {
    event: 'report_generation',
    status: 'failed',
    requestId: 'request-123',
    stage: 'quality_validation',
    durationMs: 450,
    subjectCode: 'ap_calculus_bc',
    lessonCount: 12,
    issueCount: 2,
    errorCode: 'UNEXPECTED_LANGUAGE',
    errorType: 'Error',
    repairAttempted: true,
  });
  assert.equal(JSON.stringify(payload).includes('studentName'), false);
  assert.equal(JSON.stringify(payload).includes('teacherNotes'), false);
});

test('generation diagnostics omit absent optional fields', () => {
  const payload = buildGenerationDiagnostic('request-456', 2000, 'started', {
    stage: 'configuration',
  }, 1900);
  assert.deepEqual(payload, {
    event: 'report_generation',
    status: 'started',
    requestId: 'request-456',
    stage: 'configuration',
    durationMs: 0,
  });
});
