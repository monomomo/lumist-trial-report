import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildFallbackReport } from '../public/report/report-domain.js';
import { normalizeGenerationInput } from '../public/report/generation-policy.js';
import { reportCreateSchema, reportUpdateSchema } from '../lib/reports/schema.ts';

const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.REPORT_TEST_BROWSER_CHANNEL ? { channel: process.env.REPORT_TEST_BROWSER_CHANNEL } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const input = normalizeGenerationInput({
  source: 'ai', subjectCode: 'ap_calculus_ab', studentName: '稳定性测试学生',
  currentScore: '3', targetScore: '5', examDate: '2027年5月',
  totalHours: 2, lessonCount: 2, planningScenario: 'synchronous', planningFocusAreas: [],
  includeExamTraining: false,
  teacherNotes: '本次课堂完成函数分析，学生能解释图像特征，但对定义域的判断还需练习。',
});
const report = buildFallbackReport(input.subjectCode, input);
report.planningContext = { source: 'ai', scenario: 'synchronous', lessonCount: 2, focusAreas: [], includeExamTraining: false };
report.generationInput = input;
const id = 'd9428888-122b-4e5f-a3d6-5270e4fd5f3e';
let record = {
  id, student_name: input.studentName, subject: 'AP Calculus AB',
  current_score: input.currentScore, target_score: input.targetScore, exam_date_text: input.examDate,
  original_notes: input.teacherNotes, report_data: report, course_plan: report.coursePlan,
  sales_follow_up: report.salesFollowUp, teacher_snapshot: {}, status: 'completed', updated_at: new Date().toISOString(),
};
const requests = [];
let reusableId = null;
let failReuse = false;
let failGeneration = false;
let failSave = false;
let failHistory = false;
let uploadError = 'EMPTY_DOCUMENT';
await page.route('**/api/**', async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const body = request.method() === 'GET' || !request.headers()['content-type']?.includes('application/json') ? null : request.postDataJSON();
  requests.push({ path, method: request.method(), body });
  let response;
  if (path === '/api/me') response = { accountId: 'mock-teacher', displayName: '测试老师' };
  else if (path === '/api/reports/reuse') {
    if (failReuse) return route.abort('failed');
    response = { id: reusableId };
  }
  else if (path === '/api/reports' && request.method() === 'GET') {
    if (failHistory && !new URL(request.url()).searchParams.has('id')) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'REPORT_LIST_FAILED' }) });
    response = new URL(request.url()).searchParams.has('id') ? { report: record } : { reports: [record] };
  } else if (path === '/api/reports') {
    assert.ok(['POST', 'PATCH'].includes(request.method()));
    const validation = (request.method() === 'PATCH' ? reportUpdateSchema : reportCreateSchema).safeParse(body);
    assert.equal(validation.success, true, JSON.stringify(validation.error?.issues));
    if (request.method() === 'PATCH') assert.equal(body.id, id);
    record = { ...record, student_name: body.studentName, original_notes: body.teacherNotes, report_data: body.reportData, course_plan: body.coursePlan, sales_follow_up: body.salesFollowUp };
    if (failSave) return route.abort('failed');
    response = { saved: true, id };
  } else if (path === '/api/generate-report') {
    assert.equal(body.planningSource, 'ai');
    assert.deepEqual(body.lockedCoursePlan, report.coursePlan);
    response = { report: { ...report, overview: '我根据补充的课堂观察更新了本次试听总结。', coursePlan: body.lockedCoursePlan } };
  } else if (path === '/api/generate-report-batch') {
    if (failGeneration) return route.abort('failed');
    const stage = report.coursePlan.stages[0];
    response = body.operation === 'outline'
      ? { outline: { ...report, rationale: report.coursePlan.rationale, stages: [{ title: stage.title, description: stage.description, lessonCount: 2, startLessonNumber: 1, durations: [1, 1] }] }, targetScore: '5' }
      : { lessons: report.coursePlan.stages.flatMap((item) => item.lessons) };
  } else if (path === '/api/parse-course-plan') {
    return route.fulfill({ status: uploadError === 'UNAUTHORIZED' ? 401 : 400, contentType: 'application/json', body: JSON.stringify({ error: uploadError }) });
  } else throw new Error('Unexpected API: ' + path);
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
});

async function submit() {
  await page.locator('#generate-report').click();
  await page.locator('[data-checklist-action="confirm"]').click();
  await page.locator('#report-view').waitFor({ state: 'visible' });
}

try {
  await page.goto((process.env.REPORT_TEST_URL || 'http://localhost:3011') + '/report/index.html', { waitUntil: 'domcontentloaded' });
  console.log('Opened report form');
  await page.getByRole('button', { name: '历史报告', exact: true }).click();
  await page.locator('[data-history-id]').click();
  await page.locator('#report-view').waitFor({ state: 'visible' });
  await page.locator('#regenerate-report').click();
  assert.equal(await page.locator('#teacher-notes').inputValue(), input.teacherNotes);
  assert.equal(await page.locator('[name="regeneration-plan-mode"][value="preserve"]').isChecked(), true);
  const previousCount = requests.length;
  await submit();
  assert.equal(requests.slice(previousCount).some((item) => item.path.includes('generate-report') || item.method === 'PATCH'), false);
  console.log('PASS: identical current input preserves the report without generation or duplicate saves');

  await page.locator('#regenerate-report').click();
  await page.locator('#teacher-notes').fill(input.teacherNotes + '补充：学生能独立检查边界条件。');
  await submit();
  await page.waitForFunction(() => document.querySelector('#report-view .eyebrow').textContent === '报告已自动保存');
  assert.deepEqual(record.course_plan, report.coursePlan);
  assert.equal(requests.filter((item) => item.path === '/api/generate-report').length, 1);
  assert.equal(requests.filter((item) => item.path === '/api/generate-report-batch').length, 0);
  console.log('PASS: feedback-only changes update the same saved report and preserve every lesson');

  await page.locator('#regenerate-report').click();
  await page.locator('[name="regeneration-plan-mode"][value="replace"]').check();
  await submit();
  await page.waitForFunction(() => document.querySelector('#report-view .eyebrow').textContent === '报告已自动保存');
  assert.equal(requests.filter((item) => item.path === '/api/generate-report-batch').length, 2);
  console.log('PASS: explicit replanning calls outline and stage generation');

  reusableId = id;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#subject-search').fill('AP Calculus AB');
  await page.locator('[data-subject-code="ap_calculus_ab"]').click();
  await page.locator('#student-name').fill(record.student_name);
  await page.locator('#current-score').fill('3');
  await page.locator('#target-score').fill('5');
  assert.equal(await page.locator('#ap-exam-date').inputValue(), input.examDate);
  await page.locator('#total-hours').fill('2');
  await page.locator('#lesson-count').fill('2');
  await page.locator('#planning-scenario').evaluate((element) => {
    element.value = 'synchronous';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('#teacher-notes').fill(record.original_notes);
  const generationCount = requests.filter((item) => item.path.includes('generate-report')).length;
  await submit();
  assert.equal(requests.filter((item) => item.path.includes('generate-report')).length, generationCount);
  assert.match(await page.locator('#report-view .eyebrow').first().textContent(), /已打开之前保存的报告/);
  assert.deepEqual(errors, []);
  console.log('PASS: repeated input in a fresh page opens the existing history record');
  await page.getByRole('button', { name: '新建试听报告', exact: true }).click();
  await page.locator('#subject-search').fill('SAT 数学');
  await page.locator('[data-subject-code="sat_math"]').click();
  assert.equal(await page.locator('#total-hours').getAttribute('readonly'), '');
  await page.locator('#lesson-count').fill('11');
  const mathInputs = page.locator('[data-sat-math-hours]');
  for (const [index, hours] of [5, 6, 3, 4, 2].entries()) await mathInputs.nth(index).fill(String(hours));
  assert.equal(await page.locator('#total-hours').inputValue(), '20');
  await mathInputs.nth(0).fill('5.5');
  assert.equal(await page.locator('#total-hours').inputValue(), '20.5');
  assert.equal(await page.locator('#lesson-count').inputValue(), '11');
  await mathInputs.nth(0).fill('');
  assert.match(await page.locator('#sat-math-hours-summary').textContent(), /填写全部/);
  await page.locator('#subject-search').fill('AP Calculus AB');
  await page.locator('[data-subject-code="ap_calculus_ab"]').click();
  assert.equal(await page.locator('#total-hours').getAttribute('readonly'), null);
  assert.equal(await page.locator('#total-hours').inputValue(), '');
  assert.deepEqual(errors, []);
  console.log('PASS: SAT Math automatically sums area hours, preserves independent lesson counts and restores AP manual entry');
  failReuse = true;
  await page.locator('#student-name').fill(input.studentName);
  await page.locator('#current-score').fill('3');
  await page.locator('#target-score').fill('5');
  await page.locator('#total-hours').fill('2');
  await page.locator('#lesson-count').fill('2');
  await page.locator('#planning-scenario').evaluate((element) => { element.value = 'synchronous'; element.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.locator('#teacher-notes').fill(input.teacherNotes);
  const reuseCount = requests.filter((item) => item.path === '/api/reports/reuse').length;
  const batchCount = requests.filter((item) => item.path === '/api/generate-report-batch').length;
  await submit();
  await page.waitForFunction(() => document.querySelector('#report-view .eyebrow').textContent === '报告已自动保存');
  assert.equal(requests.filter((item) => item.path === '/api/reports/reuse').length - reuseCount, 2);
  assert.equal(requests.filter((item) => item.path === '/api/generate-report-batch').length - batchCount, 2);
  console.log('PASS: a persistent reuse lookup network failure retries twice and still generates the report');
  failGeneration = true;
  await page.locator('#regenerate-report').click();
  await page.locator('[name="regeneration-plan-mode"][value="replace"]').check();
  const failedBatchStart = requests.filter((item) => item.path === '/api/generate-report-batch').length;
  await page.locator('#generate-report').click();
  await page.locator('[data-checklist-action="confirm"]').click();
  await page.waitForFunction(() => document.querySelector('#generation-notice').classList.contains('error'));
  const notice = await page.locator('#generation-notice').textContent();
  assert.match(notice, /网络连接中断/);
  assert.doesNotMatch(notice, /渲染异常/);
  assert.equal(requests.filter((item) => item.path === '/api/generate-report-batch').length - failedBatchStart, 2);
  assert.deepEqual(errors, []);
  console.log('PASS: persistent generation connection failures stop after two attempts and are not labeled rendering errors');
  failGeneration = false;
  failSave = true;
  await page.getByRole('button', { name: '新建试听报告', exact: true }).click();
  await page.locator('#generation-notice [data-workflow-action="generate"]').click();
  await page.locator('[data-checklist-action="confirm"]').click();
  await page.locator('#report-operation-notice:not(.hidden)').waitFor();
  assert.match(await page.locator('#report-operation-notice').textContent(), /报告尚未保存/);
  assert.match(await page.locator('#report-operation-notice').textContent(), /不要关闭页面/);
  const failedSave = requests.filter((item) => item.path === '/api/reports' && item.method === 'POST').at(-1);
  assert.ok(failedSave.body.saveToken);
  const beforeSaveRetry = requests.filter((item) => item.path.includes('generate-report')).length;
  failSave = false;
  await page.locator('#report-operation-notice [data-workflow-action="save"]').click();
  await page.locator('#report-operation-notice').waitFor({ state: 'hidden' });
  const retriedSave = requests.filter((item) => item.path === '/api/reports' && item.method === 'POST').at(-1);
  assert.equal(retriedSave.body.saveToken, failedSave.body.saveToken);
  assert.equal(requests.filter((item) => item.path.includes('generate-report')).length, beforeSaveRetry);
  console.log('PASS: failed saves retain the report and retry the same save token without regenerating');

  await page.locator('#regenerate-report').click();
  await page.locator('[name="regeneration-plan-mode"][value="replace"]').check();
  await page.evaluate(() => {
    Object.defineProperty(document.querySelector('#overview-text'), 'textContent', {
      configurable: true,
      set() { delete this.textContent; throw new Error('TypeError private_debug_details'); },
    });
  });
  await submit();
  await page.locator('#report-operation-notice:not(.hidden)').waitFor();
  const renderNotice = await page.locator('#report-operation-notice').textContent();
  assert.match(renderNotice, /先保存报告/);
  assert.doesNotMatch(renderNotice, /private_debug|TypeError/);
  assert.equal(await page.locator('#report-operation-notice [data-workflow-action="save"]').isVisible(), true);
  const beforeRenderRetry = requests.filter((item) => item.path.includes('generate-report')).length;
  await page.locator('#report-operation-notice [data-workflow-action="render"]').click();
  await page.locator('#report-operation-notice').waitFor({ state: 'hidden' });
  assert.equal(requests.filter((item) => item.path.includes('generate-report')).length, beforeRenderRetry);
  await page.locator('#save-report').click();
  console.log('PASS: rendering failures offer saving and reloading the valid report without regenerating');

  failHistory = true;
  await page.getByRole('button', { name: '历史报告', exact: true }).click();
  await page.locator('#history-error-notice').waitFor();
  assert.match(await page.locator('#history-error-notice').textContent(), /不表示历史报告已丢失/);
  failHistory = false;
  await page.locator('#history-error-notice [data-workflow-action="history"]').click();
  await page.locator('[data-history-id]').click();
  await page.locator('#report-view').waitFor({ state: 'visible' });
  console.log('PASS: historical lookup errors can be retried in place without regenerating reports');

  await page.route('**/*-print.jpg', (route) => route.abort('failed'));
  await page.evaluate(() => { window.print = () => { window.testPrintCalls = (window.testPrintCalls || 0) + 1; }; });
  await page.locator('#print-report').click();
  await page.locator('#report-operation-notice:not(.hidden)').waitFor();
  assert.match(await page.locator('#report-operation-notice').textContent(), /部分图片尚未加载成功/);
  assert.equal(await page.locator('#print-report').isEnabled(), true);
  assert.equal(await page.evaluate(() => window.testPrintCalls || 0), 0);
  console.log('PASS: image failures stop incomplete PDF export, explain the next step, and restore the export button');

  await page.getByRole('button', { name: '新建试听报告', exact: true }).click();
  await page.locator('label:has([name="planning-source"][value="upload"])').click();
  await page.locator('#course-plan-file').setInputFiles({ name: 'scanned-plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('scanned PDF fixture') });
  await page.locator('#course-plan-upload-status.workflow-error').waitFor();
  assert.match(await page.locator('#course-plan-upload-status').textContent(), /扫描件或图片 PDF/);
  assert.match(await page.locator('#course-plan-upload-status').textContent(), /Word、Excel/);
  assert.deepEqual(errors, []);
  console.log('PASS: scan-only upload errors explain which readable file format to upload instead');
  uploadError = 'UNAUTHORIZED';
  const notesBeforeExpiry = await page.locator('#teacher-notes').inputValue();
  await page.locator('#course-plan-file').setInputFiles({ name: 'retry-plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('PDF fixture') });
  await page.locator('#course-plan-upload-status a[target="_blank"]').waitFor();
  assert.match(await page.locator('#course-plan-upload-status').textContent(), /不要刷新或关闭/);
  assert.equal(await page.locator('#teacher-notes').inputValue(), notesBeforeExpiry);
  console.log('PASS: expired login offers a new login window and preserves existing form contents');
  await page.locator('label:has([name="planning-source"][value="ai"])').click();
  await page.locator('#student-name').fill('   ');
  const requestsBeforeInvalidInput = requests.length;
  await page.locator('#generate-report').click();
  assert.match(await page.locator('#generation-notice').textContent(), /请检查学生姓名/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'student-name');
  assert.equal(requests.length, requestsBeforeInvalidInput);
  console.log('PASS: whitespace-only student names are identified before any generation request');
  await page.locator('#student-name').fill(input.studentName);
  await page.locator('#teacher-notes').fill('太短');
  await page.locator('#generate-report').click();
  assert.match(await page.locator('#generation-notice').textContent(), /20–6000/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'teacher-notes');
  console.log('PASS: short feedback receives Chinese writing guidance and field focus');

  await page.evaluate(() => {
    Object.defineProperty(document.querySelector('#overview-text'), 'textContent', {
      configurable: true,
      set() { delete this.textContent; throw new Error('preview_error_private_details'); },
    });
  });
  await page.locator('#quick-preview-report').click();
  assert.match(await page.locator('#generation-notice').textContent(), /还没有生成正式报告/);
  assert.equal(await page.locator('#generation-notice [data-workflow-action="save"]').count(), 0);
  await page.locator('#generation-notice [data-workflow-action="quick-preview"]').click();
  await page.locator('#report-view').waitFor({ state: 'visible' });
  assert.match(await page.locator('#report-view .eyebrow').first().textContent(), /未生成、未保存/);
  assert.equal(await page.locator('#save-report').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log('PASS: style preview failures can retry without saving example content as an AI report');
} catch (error) {
  console.error({ errors, apiRequests: requests.map(({ path, method }) => ({ path, method })), history: await page.locator('#history-list').textContent(), examOptions: await page.locator('#ap-exam-date').innerHTML() });
  throw error;
} finally {
  await browser.close();
}
