import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkflowError } from '../public/report/workflow-errors.js';
import { getAccountErrorMessage } from '../lib/auth/error-messages.ts';
import { reportCreateSchema } from '../lib/reports/schema.ts';
import { waitForImage } from '../public/report/export-utils.js';

test('AI output failures prescribe retry rather than blaming correctly filled teacher notes', () => {
  for (const code of ['STAGE_LESSON_COUNT_MISMATCH', 'OUTLINE_LESSON_COUNT_MISMATCH', 'SAT_MATH_HOURS_MISMATCH', 'EMPTY_MODEL_OUTPUT', 'INVALID_UNIT_CODE', 'REPORT_QUALITY_FAILED']) {
    const result = getWorkflowError(new Error(code));
    assert.equal(result.category, 'model', code);
    assert.equal(result.actionId, 'generate', code);
    assert.match(result.action, /继续生成/, code);
    assert.doesNotMatch(JSON.stringify(result), /teacherNotes|schema|JSON|undefined|TypeError|Zod/);
  }
});

test('unexpected technical and database details never become teacher-facing instructions', () => {
  const result = getWorkflowError({ message: 'SQL query failure private_student_data', reason: 'stack TypeError internal_secret', status: 500 });
  assert.doesNotMatch(JSON.stringify(result), /SQL|private_student|internal_secret|TypeError/);
  assert.ok(result.action);
});

test('recoverable failures prioritize self-service instead of contacting administrators', () => {
  for (const code of ['INVALID_RESPONSE', 'EMPTY_MODEL_OUTPUT', 'REPORT_QUALITY_FAILED', 'COURSE_PLAN_PARSE_FAILED', 'REPORT_RENDER_FAILED']) {
    const result = getWorkflowError(new Error(code));
    assert.doesNotMatch(result.action, /管理员/);
    assert.ok(result.actionId);
  }
  assert.match(getWorkflowError(new Error('REPORT_RENDER_FAILED')).action, /重新加载报告/);
  assert.match(getWorkflowError(new Error('COURSE_PLAN_PARSE_FAILED'), { operation: 'upload' }).action, /另存为 Word 或 Excel/);
  assert.match(getWorkflowError(new Error('AI_SERVICE_NOT_CONFIGURED')).action, /管理员/);
});

test('input failures point to the correct field with a concrete correction', () => {
  const result = getWorkflowError({ message: 'INVALID_INPUT', issues: [{ path: 'teacherNotes' }] });
  assert.equal(result.focus, '#teacher-notes');
  assert.match(result.action, /20–6000/);
  assert.match(result.action, /讲了什么/);
  const internal = getWorkflowError({ message: 'INVALID_INPUT', issues: [{ path: 'durations' }] });
  assert.equal(internal.category, 'service');
});

test('login expiry preserves the current page and offers a separate login window', () => {
  for (const operation of ['generate', 'save', 'upload', 'history', 'export']) {
    const result = getWorkflowError({ status: 401 }, { operation });
    assert.equal(result.actionId, 'login');
    assert.match(result.reason, /不要刷新或关闭/);
    assert.match(result.action, /新窗口/);
  }
});

test('failed saves tell teachers to preserve the existing report, not regenerate', () => {
  for (const code of ['REPORT_SAVE_FAILED', 'NETWORK_ERROR', 'REQUEST_TIMEOUT', 'INVALID_RESPONSE']) {
    const result = getWorkflowError(new Error(code), { operation: 'save' });
    assert.equal(result.actionId, 'save');
    assert.match(result.action, /重新保存/);
    assert.match(result.action, /不要关闭|不要直接关闭/);
  }
});

test('course plan save validation identifies the exact stage and lesson', () => {
  const result = getWorkflowError({ message: 'INVALID_REPORT_DATA', issues: [{ path: 'coursePlan.stages.1.lessons.3.duration' }] }, { operation: 'save' });
  assert.match(result.reason, /第 2 阶段第 4 课/);
  assert.match(result.action, /0.5、1、1.5 或 2/);
  assert.equal(result.actionId, 'edit-plan');
});

test('render failures offer saving the generated result before retrying preview', () => {
  const result = getWorkflowError({ message: 'TypeError', generationStage: 'render' });
  assert.equal(result.actionId, 'save');
  assert.match(result.action, /先保存报告/);
  assert.doesNotMatch(JSON.stringify(result), /TypeError/);
  const preview = getWorkflowError(new Error('QUICK_PREVIEW_FAILED'), { operation: 'preview' });
  assert.notEqual(preview.actionId, 'save');
  assert.equal(preview.actionId, 'quick-preview');
});

test('scan-only PDFs and overlong documents explain how to replace the file', () => {
  assert.match(getWorkflowError(new Error('EMPTY_DOCUMENT'), { operation: 'upload' }).action, /扫描件|图片 PDF/);
  assert.match(getWorkflowError(new Error('DOCUMENT_TOO_LONG'), { operation: 'upload' }).action, /5 万字/);
  assert.equal(getWorkflowError(new Error('UNSUPPORTED_FILE_TYPE'), { operation: 'upload' }).actionId, 'input');
});

test('login distinguishes credential errors, account bans, rate limits and connection failures', () => {
  assert.match(getAccountErrorMessage({ code: 'invalid_credentials' }, 'login'), /账号或密码/);
  assert.match(getAccountErrorMessage({ code: 'invalid_credentials' }, 'verify'), /当前密码/);
  assert.match(getAccountErrorMessage({ code: 'user_banned' }, 'login'), /停用/);
  assert.match(getAccountErrorMessage({ status: 429 }, 'login'), /1 分钟/);
  assert.doesNotMatch(getAccountErrorMessage({ name: 'AuthRetryableFetchError' }, 'login'), /密码不正确/);
});

test('report creation accepts a stable retry token and rejects malformed tokens', () => {
  const shape = reportCreateSchema.shape.saveToken;
  assert.equal(shape.safeParse('b7ec88c5-447e-4f9b-88ea-34f59fa3db03').success, true);
  assert.equal(shape.safeParse('wrong-id').success, false);
});

class FakeImage extends EventTarget {
  complete = false;
  naturalWidth = 0;
  async decode() {}
}

test('export waits for successfully loaded images but rejects broken and stalled images', async () => {
  const loaded = new FakeImage();
  loaded.complete = true;
  loaded.naturalWidth = 100;
  await waitForImage(loaded);
  const broken = new FakeImage();
  broken.complete = true;
  await assert.rejects(waitForImage(broken), /EXPORT_IMAGES_FAILED/);
  await assert.rejects(waitForImage(new FakeImage(), { timeoutMs: 1 }), /EXPORT_IMAGES_FAILED/);
  const eventual = new FakeImage();
  const pending = waitForImage(eventual);
  eventual.naturalWidth = 100;
  eventual.dispatchEvent(new Event('load'));
  await pending;
});
