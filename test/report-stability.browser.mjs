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
const teachingPlan = (plan) => JSON.parse(JSON.stringify(plan, (key, value) => key === 'id' ? undefined : value));
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
let batchGate = null;
let failSave = false;
let failHistory = false;
let uploadError = 'EMPTY_DOCUMENT';
let expireProfile = false;
await page.route('**/api/**', async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const body = request.method() === 'GET' || !request.headers()['content-type']?.includes('application/json') ? null : request.postDataJSON();
  requests.push({ path, method: request.method(), body });
  let response;
  if (path === '/api/me') {
    if (expireProfile) return route.fulfill({ status: 401, json: { error: 'UNAUTHORIZED' } });
    response = { accountId: 'mock-teacher', displayName: '测试老师' };
  }
  else if (path === '/api/review-feedback') response = { notes: input.teacherNotes, missing: ['请核对已有阶段测成绩，未测时可安排初测。'] };
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
    assert.deepEqual(teachingPlan(body.lockedCoursePlan), teachingPlan(report.coursePlan));
    response = { report: { ...report, overview: '我根据补充的课堂观察更新了本次试听总结。', coursePlan: body.lockedCoursePlan } };
  } else if (path === '/api/generate-report-batch') {
    if (failGeneration) return route.abort('failed');
    if (batchGate) await batchGate[body.operation]?.promise;
    const stage = report.coursePlan.stages[0];
    response = body.operation === 'outline'
      ? { outline: { ...report, rationale: report.coursePlan.rationale, stages: [{ title: stage.title, description: stage.description, lessonCount: 2, startLessonNumber: 1, durations: [1, 1], assessment: { task: '限时完成两道连续性判断题，按判断依据计分。', target: '至少 8/10', adjustment: '未达标时复练左右极限的判断依据。' } }] }, targetScore: '5' }
      : { lessons: report.coursePlan.stages.flatMap((item) => item.lessons) };
  } else if (path === '/api/parse-course-plan') {
    return route.fulfill({ status: uploadError === 'UNAUTHORIZED' ? 401 : 400, contentType: 'application/json', body: JSON.stringify({ error: uploadError }) });
  } else throw new Error('Unexpected API: ' + path);
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
});

async function showFormModule(module) {
  if (module === 'review') return;
  const paper = page.locator('.view.active .paper-rail');
  await paper.locator(`[data-paper-chapter="${module === 'planning' ? 'plan' : 'summary'}"]`).click();
  if (module === 'student') await page.locator('#draft-student + details').evaluate(details => { details.open = true; });
  if (module === 'feedback') await page.locator('details:has(.feedback-review)').evaluate(details => { details.open = true; });
}

async function requestGeneration() {
  await showFormModule('review');
  await page.locator('#generate-report').click();
}

async function submit() {
  await requestGeneration();
  await page.locator('[data-checklist-action="confirm"]').click();
  await page.locator('#report-view.active #parent-report.layout-edit-mode').waitFor();
}

try {
  await page.goto((process.env.REPORT_TEST_URL || 'http://localhost:3011') + '/report/index.html', { waitUntil: 'domcontentloaded' });
  console.log('Opened report form');
  const sidebarWidth = (await page.locator('.sidebar').boundingBox()).width;
  await page.getByRole('button', { name:'收起导航' }).click();
  assert.ok((await page.locator('.sidebar').boundingBox()).width < sidebarWidth);
  await page.reload();
  await page.getByRole('button', { name:'展开导航' }).waitFor();
  await page.getByRole('button', { name:'展开导航' }).click();
  assert.equal((await page.locator('.sidebar').boundingBox()).width, sidebarWidth);
  await page.setViewportSize({ width:390, height:844 });
  await page.getByRole('button', { name: '历史报告', exact: true }).click();
  await page.locator('#history-view').waitFor({ state:'visible' });
  await page.setViewportSize({ width:1440, height:1000 });
  await page.locator('[data-history-id]').click();
  await page.locator('#report-view').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.report-actions #regenerate-report').count(), 1);
  assert.equal(await page.locator('.paper-rail #regenerate-report, .paper-mobile-nav option[value="source"]').count(), 0);
  await page.locator('#regenerate-report').click();
  assert.equal(await page.locator('#teacher-notes').inputValue(), input.teacherNotes);
  assert.equal(await page.locator('[name="regeneration-plan-mode"][value="preserve"]').isChecked(), true);
  const previousCount = requests.length;
  const checklist = page.locator('#generation-checklist-modal');
  for (const [width, height] of [[1440, 900], [820, 430], [390, 420], [320, 440]]) {
    await page.setViewportSize({ width, height });
    await requestGeneration();
    await checklist.waitFor();
    const body = checklist.locator('.generation-checklist-body');
    const confirm = checklist.locator('[data-checklist-action="confirm"]');
    const position = await confirm.boundingBox();
    assert.ok(position.y >= 0 && position.y + position.height <= height);
    assert.equal(await body.evaluate(element => element.scrollTop), 0);
    const scrollDistance = await body.evaluate(element => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    if (width === 1440) assert.equal(scrollDistance, 0);
    if (width === 390) assert.ok(scrollDistance > 0);
    assert.deepEqual(await confirm.boundingBox(), position);
    await checklist.getByRole('button', { name: '返回修改' }).click();
    await checklist.waitFor({ state: 'hidden' });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  console.log('PASS: generation checklist scrolls independently of its confirmation controls');
  await submit();
  assert.equal(requests.slice(previousCount).some((item) => item.path.includes('generate-report') || item.method === 'PATCH'), false);
  console.log('PASS: identical current input preserves the report without generation or duplicate saves');

  await page.locator('#regenerate-report').click();
  await page.locator('#teacher-notes').fill(input.teacherNotes + '补充：学生能独立检查边界条件。');
  await submit();
  await page.waitForFunction(() => document.querySelector('#report-view.active .eyebrow')?.textContent === '报告已保存');
  assert.deepEqual(teachingPlan(record.course_plan), teachingPlan(report.coursePlan));
  assert.equal(requests.filter((item) => item.path === '/api/generate-report').length, 1);
  assert.equal(requests.filter((item) => item.path === '/api/generate-report-batch').length, 0);
  console.log('PASS: feedback-only changes update the same saved report and preserve every lesson');

  await page.locator('#regenerate-report').click();
  await showFormModule('planning');
  await page.locator('[name="regeneration-plan-mode"][value="replace"]').check();
  await showFormModule('feedback');
  await page.locator('#teacher-notes').fill('');
  await page.locator('#feedback-family').fill(input.teacherNotes);
  await page.locator('#review-feedback').click();
  await page.locator('#feedback-review-status').getByText(/可安排初测/).waitFor();
  assert.equal(await page.locator('#teacher-notes').inputValue(), input.teacherNotes);
  await page.locator('#feedback-family').fill(input.teacherNotes + '补充观察。');
  await requestGeneration();
  assert.match(await page.locator('#feedback-review-status').textContent(), /跳过识别/);
  await page.locator('#manual-feedback').click();
  batchGate = { outline:Promise.withResolvers(), stage:Promise.withResolvers() };
  await requestGeneration();
  await page.locator('[data-checklist-action="confirm"]').click();
  await page.getByText('正在制定课程大纲', { exact:true }).waitFor();
  assert.equal(await page.locator('[data-form-module="planning"]').isDisabled(), true);
  assert.equal(await page.locator('#generation-notice').isVisible(), false);
  batchGate.outline.resolve();
  await page.getByText('正在生成课次', { exact:true }).waitFor();
  assert.equal(await page.locator('#generation-progress-meter').getAttribute('max'), '1');
  const savedBatch = page.waitForResponse(response => response.url().endsWith('/api/reports') && response.request().method() === 'PATCH');
  batchGate.stage.resolve();
  batchGate = null;
  await savedBatch;
  await page.waitForFunction(() => document.querySelector('#report-view.active .eyebrow')?.textContent === '报告已保存');
  assert.equal(requests.filter((item) => item.path === '/api/generate-report-batch').length, 2);
  assert.equal(record.course_plan.stages[0].assessment.target, '至少 8/10');
  assert.match(await page.locator('.plan-overview-stage').first().textContent(), /至少 8\/10/);
  console.log('PASS: explicit replanning calls outline and stage generation');
  await page.locator('#report-view:not(.paper-source-editing) #parent-report.layout-edit-mode').waitFor();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('.reference-plan-page').first().evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.locator('#report-view [data-paper-chapter="plan"][aria-current]').waitFor();
  await page.getByRole('button', { name: '调整课次结构' }).click();
  const planDialog = page.getByRole('dialog', { name: '调整课次结构' });
  const originalLesson = await planDialog.getByRole('textbox', { name: '第 1 课主题' }).inputValue();
  await planDialog.getByRole('button', { name: '第 1 课详情', exact: true }).click();
  const firstGoal = planDialog.getByRole('textbox', { name: '第 1 课当课目标' });
  assert.ok((await firstGoal.inputValue()).trim());
  await firstGoal.fill('复验已有课程可编辑');
  await planDialog.getByRole('button', { name: '复制第 1 课', exact: true }).click();
  await planDialog.getByRole('textbox', { name: '第 2 课主题' }).fill('新课次主题');
  await planDialog.getByRole('button', { name: '上移第 2 课', exact: true }).click();
  assert.equal(await planDialog.getByRole('textbox', { name: '第 1 课主题' }).inputValue(), '新课次主题');
  await planDialog.getByRole('button', { name: '删除第 1 课', exact: true }).click();
  assert.equal(await planDialog.getByRole('textbox', { name: '第 1 课主题' }).inputValue(), originalLesson);
  await planDialog.getByRole('button', { name: '取消', exact: true }).click();
  await page.locator('#report-view [data-paper-chapter="summary"]').click();
  await page.locator('#overview-text').click();
  const inline = page.locator('#layout-edit-dialog');
  const edited = '纸面编辑后的家长版结论。';
  await inline.getByLabel('本次试听结论').fill(edited);
  await inline.getByRole('button', { name: '应用修改' }).click();
  await page.waitForFunction(value => document.querySelector('#overview-text').textContent === value, edited);
  await page.getByRole('button', { name: '家长版预览' }).click();
  assert.equal(await page.locator('#overview-text').getAttribute('role'), null);
  assert.equal(await page.locator('#overview-text').textContent(), edited);
  await page.getByRole('button', { name: '继续编辑' }).click();
  await page.locator('#regenerate-report').click();
  const source = page.locator('#report-view.paper-source-editing #report-form');
  await source.waitFor();
  assert.equal(await page.locator('#new-view').isVisible(), false);
  assert.equal(await page.locator('#parent-conclusion').inputValue(), edited);
  await page.locator('#parent-conclusion').fill('放弃这次资料修改');
  await page.getByRole('button', { name: '取消修改' }).click();
  assert.equal(await page.locator('#overview-text').textContent(), edited);
  console.log('PASS: paper directory tracks scrolling, the course list supports row actions and source editing stays on the same report');

  reusableId = id;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await showFormModule('student');
  await page.locator('#subject-search').fill('AP Calculus AB');
  await page.locator('[data-subject-code="ap_calculus_ab"]').click();
  await page.locator('#student-name').fill(record.student_name);
  await page.locator('#current-score').fill('3');
  await page.locator('#target-score').fill('5');
  assert.equal(await page.locator('#ap-exam-date').inputValue(), input.examDate);
  await showFormModule('planning');
  await page.locator('#total-hours').fill('2');
  await page.locator('#lesson-count').fill('2');
  await page.locator('#planning-scenario').evaluate((element) => {
    element.value = 'synchronous';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await showFormModule('feedback');
  await page.locator('#teacher-notes').fill(record.original_notes);
  const generationCount = requests.filter((item) => item.path.includes('generate-report')).length;
  await submit();
  assert.equal(requests.filter((item) => item.path.includes('generate-report')).length, generationCount);
  assert.match(await page.locator('#report-view .eyebrow').first().textContent(), /已打开之前保存的报告/);
  assert.deepEqual(errors, []);
  console.log('PASS: repeated input in a fresh page opens the existing history record');
  await page.getByRole('button', { name: '新建试听报告', exact: true }).click();
  await showFormModule('student');
  await page.locator('#subject-search').fill('SAT 数学');
  await page.locator('[data-subject-code="sat_math"]').click();
  assert.equal(await page.locator('#total-hours').getAttribute('readonly'), '');
  await showFormModule('planning');
  await page.locator('#lesson-count').fill('11');
  const mathInputs = page.locator('[data-sat-math-hours]');
  for (const [index, hours] of [5, 6, 3, 4, 2].entries()) await mathInputs.nth(index).fill(String(hours));
  assert.equal(await page.locator('#total-hours').inputValue(), '20');
  await mathInputs.nth(0).fill('5.5');
  assert.equal(await page.locator('#total-hours').inputValue(), '20.5');
  assert.equal(await page.locator('#lesson-count').inputValue(), '11');
  await mathInputs.nth(0).fill('');
  assert.match(await page.locator('#sat-math-hours-summary').textContent(), /填写全部/);
  await showFormModule('student');
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
  await showFormModule('planning');
  await page.locator('#total-hours').fill('2');
  await page.locator('#lesson-count').fill('2');
  await page.locator('#planning-scenario').evaluate((element) => { element.value = 'synchronous'; element.dispatchEvent(new Event('change', { bubbles: true })); });
  await showFormModule('feedback');
  await page.locator('#teacher-notes').fill(input.teacherNotes);
  const reuseCount = requests.filter((item) => item.path === '/api/reports/reuse').length;
  const batchCount = requests.filter((item) => item.path === '/api/generate-report-batch').length;
  await submit();
  await page.waitForFunction(() => document.querySelector('#report-view.active .eyebrow')?.textContent === '报告已保存');
  assert.equal(requests.filter((item) => item.path === '/api/reports/reuse').length - reuseCount, 2);
  assert.equal(requests.filter((item) => item.path === '/api/generate-report-batch').length - batchCount, 2);
  console.log('PASS: a persistent reuse lookup network failure retries twice and still generates the report');
  failGeneration = true;
  await page.locator('#regenerate-report').click();
  await showFormModule('planning');
  await page.locator('[name="regeneration-plan-mode"][value="replace"]').check();
  const failedBatchStart = requests.filter((item) => item.path === '/api/generate-report-batch').length;
  await requestGeneration();
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
  await page.locator('#generation-notice [data-workflow-action="generate"]').click();
  await page.locator('[data-checklist-action="confirm"]').click();
  await page.locator('#report-operation-notice:not(.hidden)').waitFor();
  assert.match(await page.locator('#report-operation-notice').textContent(), /报告尚未保存/);
  assert.match(await page.locator('#report-operation-notice').textContent(), /不要关闭页面/);
  const failedSave = requests.filter((item) => item.path === '/api/reports' && item.method === 'PATCH').at(-1);
  assert.equal(failedSave.body.id, id);
  const beforeSaveRetry = requests.filter((item) => item.path.includes('generate-report')).length;
  failSave = false;
  await page.locator('#report-operation-notice [data-workflow-action="save"]').click();
  await page.locator('#report-operation-notice').waitFor({ state: 'hidden' });
  const retriedSave = requests.filter((item) => item.path === '/api/reports' && item.method === 'PATCH').at(-1);
  assert.equal(retriedSave.body.id, failedSave.body.id);
  assert.equal(requests.filter((item) => item.path.includes('generate-report')).length, beforeSaveRetry);
  console.log('PASS: failed saves retain the report and retry the same report update without regenerating');

  await page.locator('#regenerate-report').click();
  await showFormModule('planning');
  await page.locator('[name="regeneration-plan-mode"][value="replace"]').check();
  await page.evaluate(() => {
    Object.defineProperty(document.querySelector('#overview-text'), 'textContent', {
      configurable: true,
      set() { delete this.textContent; throw new Error('TypeError private_debug_details'); },
    });
  });
  await requestGeneration();
  await page.locator('[data-checklist-action="confirm"]').click();
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

  await page.route(/-print\.jpg(?:\?|$)/, (route) => route.abort('failed'));
  failHistory = true;
  await page.getByRole('button', { name: '历史报告', exact: true }).click();
  await page.locator('#history-error-notice').waitFor();
  assert.match(await page.locator('#history-error-notice').textContent(), /不表示历史报告已丢失/);
  failHistory = false;
  await page.locator('#history-error-notice [data-workflow-action="history"]').click();
  await page.locator('[data-history-id]').click();
  await page.locator('#report-view').waitFor({ state: 'visible' });
  console.log('PASS: historical lookup errors can be retried in place without regenerating reports');

  await page.locator('#report-cover-image').evaluate(image => {
    image.dataset.printSrc += '?test-image-failure';
  });
  await page.evaluate(() => { window.print = () => { window.testPrintCalls = (window.testPrintCalls || 0) + 1; }; });
  await page.locator('#print-report').click();
  await page.locator('#report-operation-notice:not(.hidden)').waitFor();
  assert.match(await page.locator('#report-operation-notice').textContent(), /未能加载。导出已自动重试一次/);
  assert.equal(await page.locator('#print-report').isEnabled(), true);
  assert.equal(await page.evaluate(() => window.testPrintCalls || 0), 0);
  console.log('PASS: image failures stop incomplete PDF export, explain the next step, and restore the export button');
  await page.unroute(/-print\.jpg(?:\?|$)/);

  await page.getByRole('button', { name: '新建试听报告', exact: true }).click();
  await showFormModule('planning');
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
  await showFormModule('student');
  await page.locator('#student-name').fill('   ');
  const requestsBeforeInvalidInput = requests.length;
  await requestGeneration();
  assert.match(await page.locator('#generation-notice').textContent(), /请检查学生姓名/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'student-name');
  assert.equal(requests.length, requestsBeforeInvalidInput);
  console.log('PASS: whitespace-only student names are identified before any generation request');
  await page.locator('#student-name').fill(input.studentName);
  await showFormModule('feedback');
  await page.locator('#teacher-notes').fill('太短');
  await requestGeneration();
  assert.match(await page.locator('#generation-notice').textContent(), /20–6000/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'teacher-notes');
  console.log('PASS: short feedback receives Chinese writing guidance and field focus');

  await page.evaluate(() => {
    Object.defineProperty(document.querySelector('#overview-text'), 'textContent', {
      configurable: true,
      set() { delete this.textContent; throw new Error('preview_error_private_details'); },
    });
  });
  await showFormModule('review');
  await page.locator('#quick-preview-report').click();
  assert.match(await page.locator('#generation-notice').textContent(), /还没有生成正式报告/);
  assert.equal(await page.locator('#generation-notice [data-workflow-action="save"]').count(), 0);
  await page.locator('#generation-notice [data-workflow-action="quick-preview"]').click();
  await page.locator('#report-view').waitFor({ state: 'visible' });
  assert.match(await page.locator('#report-view .eyebrow').first().textContent(), /未生成、未保存/);
  assert.equal(await page.locator('#save-report').isVisible(), false);
  await page.locator('[data-preview-mode="preview"]').click();
  assert.equal(await page.locator('#back-edit').isVisible(), true);
  await page.locator('#back-edit').click();
  assert.equal(await page.locator('#new-view').isVisible(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: style preview can retry and return to the form from the complete layout');
  const shortRecord = record;
  const longStages = Array.from({ length:20 }, (_, index) => ({
    ...report.coursePlan.stages[0], title:'阶段' + index + '阶段主题'.repeat(12),
    description:'本阶段练习与课堂反馈'.repeat(12),
    assessment:{ objective:'能独立判断函数是否连续并解释依据', task:'完成阶段测', target:'根据阶段测试检验学习表现'.repeat(9), adjustment:'复练后再次测评' },
    lessons:[report.coursePlan.stages[0].lessons[0]],
  }));
  const longPlan = { ...report.coursePlan, totalHours:20, stages:longStages };
  record = { ...record, course_plan:longPlan, report_data:{ ...record.report_data, coursePlan:longPlan,
    generationInput:{ ...input, teacherNotes:input.teacherNotes+'\n【校内考试】{"name":"校内单元测验","date":"","scope":"连续性","hours":"2"}' },
  } };
  await page.getByRole('button', {name:'历史报告', exact:true}).click();
  await page.locator('[data-history-id]').click();
  await page.waitForFunction(() => document.querySelectorAll('.plan-overview-stage').length === 20);
  await page.locator('.reference-plan-page').getByRole('heading',{name:'校内考试安排',exact:true,includeHidden:true}).waitFor({state:'attached'});
  assert.match(await page.locator('.reference-plan-page').getByText('校内单元测验 · 日期待确认',{exact:true}).textContent(),/日期待确认/);
  await page.getByRole('link', { name:'查看阶段 2 的课次' }).click();
  const detail = page.locator('.plan-stage-group[data-stage-index="1"]').first();
  await page.waitForFunction(() => {
    const stage = document.querySelector('.plan-stage-group[data-stage-index="1"]');
    const bar = document.querySelector('.report-navigation');
    return stage.getBoundingClientRect().top >= bar.getBoundingClientRect().bottom
      && stage.getBoundingClientRect().top < bar.getBoundingClientRect().bottom + 50;
  });
  assert.equal(await detail.isVisible(), true);
  const stageMenu = page.locator('.paper-stage-jump');
  await stageMenu.locator('summary').click();
  assert.equal(await stageMenu.locator('.paper-stage-choice').count(), 20);
  await stageMenu.locator('.paper-stage-choice').nth(3).click();
  assert.equal(await stageMenu.getAttribute('open'), null);
  await page.getByRole('button', { name:'调整课次结构' }).click();
  assert.equal(await planDialog.getByRole('button', { name:'编辑阶段 4', exact:true }).getAttribute('aria-current'), 'true');
  await planDialog.getByRole('button', { name:'编辑阶段 2', exact:true }).click();
  assert.equal(await planDialog.getByRole('textbox', { name:'阶段 2 名称' }).count(), 1);
  assert.equal(await planDialog.getByRole('textbox', { name:'阶段 4 名称' }).count(), 0);
  const grip = planDialog.getByRole('button', { name:'编辑阶段 2', exact:true });
  const movingStage = await planDialog.getByRole('textbox', { name:'阶段 2 名称' }).inputValue();
  const start = await grip.boundingBox();
  const end = await planDialog.locator('[data-stage-item="0"]').boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps:8 });
  await page.mouse.up();
  assert.equal(await planDialog.getByRole('textbox', { name:'阶段 1 名称' }).inputValue(), movingStage);
  await planDialog.getByRole('button', { name:'编辑阶段 1', exact:true }).press('ArrowDown');
  assert.equal(await planDialog.getByRole('textbox', { name:'阶段 2 名称' }).inputValue(), movingStage);

  await planDialog.getByRole('button', { name:'取消', exact:true }).click();
  await page.emulateMedia({ media:'print' });
  const detailLinks = await page.locator('.report-stage-page-link').evaluateAll(links => links.map(link => {
    const target = document.getElementById(link.hash.slice(1));
    return Boolean(target?.matches('.report-detail-page')) && link.textContent.includes(target.querySelector('.report-page-number span').textContent.split(' / ')[0]);
  }));
  assert.equal(detailLinks.length, 20);
  assert.ok(detailLinks.every(Boolean));
  const occupied = await page.locator('.report-detail-page').evaluateAll(pages => pages.every(sheet =>
    sheet.querySelector('.plan-lesson-row') && sheet.scrollHeight <= sheet.clientHeight + 1));
  assert.ok(occupied);
  console.log('PASS: twenty stages paginate with physical PDF page ranges and stable stage links');
  await page.emulateMedia({ media:'screen' });
  record = shortRecord;
  await page.getByRole('button', { name: '历史报告', exact: true }).click();
  await page.locator('[data-history-id]').click();
  await page.locator('#parent-report.layout-edit-mode').waitFor();
  await page.locator('#regenerate-report').click();
  const manuallyWritten = '这段是老师写给家长的试听结论。';
  await page.locator('#parent-conclusion').fill(manuallyWritten);
  const manualStart = requests.length;
  const savedConclusion = page.waitForResponse(response => response.url().endsWith('/api/reports') && response.request().method() === 'PATCH');
  await submit();
  await savedConclusion;
  assert.equal(record.report_data.overview, manuallyWritten);
  assert.equal(record.course_plan.stages.length, shortRecord.course_plan.stages.length);
  assert.equal(requests.slice(manualStart).some(item => item.path.includes('generate-report')), false);
  await page.getByRole('button', { name: '家长版预览' }).click();
  const preview = page.locator('#parent-report.paper-readonly');
  assert.equal(await preview.locator('#overview-text').textContent(), manuallyWritten);
  async function conclusionGeometry() {
    return preview.locator('#overview-text').evaluate(field => {
      const sheet = field.closest('.report-page').getBoundingClientRect();
      const bounds = field.getBoundingClientRect();
      return [sheet.width, sheet.height, bounds.left - sheet.left, bounds.top - sheet.top].map(Math.round);
    });
  }
  const previewGeometry = await conclusionGeometry();
  await page.emulateMedia({ media: 'print' });
  assert.deepEqual(await conclusionGeometry(), previewGeometry);
  assert.equal(await page.locator('#report-view .paper-rail').isVisible(), false);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  await page.emulateMedia({ media: 'screen' });
  console.log('PASS: hand-written conclusions update the same report and appear in the A4 preview and PDF');
  await page.getByRole('button', { name: '继续编辑' }).click();
  await page.locator('#report-view [data-paper-chapter="plan"]').click();
  await page.getByRole('button', { name: '调整课次结构' }).click();
  await planDialog.getByRole('textbox', { name: '第 1 课主题' }).fill('课次结构修改后的第一课');
  const savedPlan = page.waitForResponse(response => response.url().endsWith('/api/reports') && response.request().method() === 'PATCH');
  await planDialog.getByRole('button', { name: '应用到报告' }).click();
  await savedPlan;
  assert.equal(record.course_plan.stages[0].lessons[0].theme, '课次结构修改后的第一课');
  assert.equal(await page.locator('[data-layout-path="plan.0.lessons.0.theme"]').first().textContent(), '课次结构修改后的第一课');
  console.log('PASS: applying the course list updates the printed plan and saves the same history record');
  await page.setViewportSize({ width:390, height:844 });
  const mobileReport = page.locator('#parent-report.layout-edit-mode');
  await page.waitForFunction(() => {
    const report = document.querySelector('#parent-report');
    return report.scrollWidth <= report.clientWidth + 1;
  });
  await page.getByRole('button', { name:'放大报告' }).click();
  assert.ok(await mobileReport.evaluate(report => report.scrollWidth > report.clientWidth));
  await page.getByRole('button', { name:'报告适配屏宽' }).click();
  assert.ok(await mobileReport.evaluate(report => report.scrollWidth <= report.clientWidth + 1));
  await page.locator('#report-view .paper-mobile-nav').selectOption('summary');
  await page.locator('#overview-text').click();
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'height', { value:300, configurable:true });
    visualViewport.dispatchEvent(new Event('resize'));
  });
  const editDialog = page.locator('#layout-edit-dialog');
  const editButton = await editDialog.getByRole('button', { name:'应用修改' }).boundingBox();
  assert.ok(editButton.y >= 0 && editButton.y + editButton.height <= 300);
  await editDialog.getByRole('button', { name:'取消' }).click();
  await page.evaluate(() => { delete visualViewport.height; });
  await page.waitForFunction(() => document.activeElement.id === 'overview-text');
  console.log('PASS: mobile report fits the screen, zooms on demand and keeps the editor clear of the keyboard');
  expireProfile = true;
  await page.reload({ waitUntil:'domcontentloaded' });
  const accountNotice = page.locator('.main > #account-notice');
  await accountNotice.getByRole('link', { name:'在新窗口重新登录' }).waitFor();
  assert.equal(await page.locator('#sidebar-teacher').isVisible(), false);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height:900 });
    assert.ok(await accountNotice.evaluate((notice) => notice.scrollWidth <= notice.clientWidth));
    assert.equal(await page.locator('#quick-preview-report').isVisible(), true);
  }
  assert.equal(await page.locator('#draft-status').textContent(), '草稿暂未保存');
  expireProfile = false;
  await accountNotice.getByRole('link', { name:'在新窗口重新登录' }).evaluate((link) => {
    link.addEventListener('click', (event) => event.preventDefault(), { once:true });
    link.click();
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await accountNotice.waitFor({ state:'hidden' });
  assert.equal(await page.locator('#sidebar-teacher').isVisible(), true);
  console.log('PASS: expired teacher session is readable and is rechecked after returning');
} catch (error) {
  console.error({ errors, apiRequests: requests.map(({ path, method }) => ({ path, method })), history: await page.locator('#history-list').textContent(), examOptions: await page.locator('#ap-exam-date').innerHTML() });
  throw error;
} finally {
  await browser.close();
}
