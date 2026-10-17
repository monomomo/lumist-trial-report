import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildFallbackReport } from '../public/report/report-domain.js';
import { normalizeGenerationInput } from '../public/report/generation-policy.js';
import { reportUpdateSchema } from '../lib/reports/schema.ts';

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
await page.route('**/api/**', async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const body = request.method() === 'GET' ? null : request.postDataJSON();
  requests.push({ path, method: request.method(), body });
  let response;
  if (path === '/api/me') response = { accountId: 'mock-teacher', displayName: '测试老师' };
  else if (path === '/api/reports/reuse') response = { id: reusableId };
  else if (path === '/api/reports' && request.method() === 'GET') {
    response = new URL(request.url()).searchParams.has('id') ? { report: record } : { reports: [record] };
  } else if (path === '/api/reports') {
    assert.equal(request.method(), 'PATCH');
    const validation = reportUpdateSchema.safeParse(body);
    assert.equal(validation.success, true, JSON.stringify(validation.error?.issues));
    assert.equal(body.id, id);
    record = { ...record, student_name: body.studentName, original_notes: body.teacherNotes, report_data: body.reportData, course_plan: body.coursePlan, sales_follow_up: body.salesFollowUp };
    response = { saved: true, id };
  } else if (path === '/api/generate-report') {
    assert.equal(body.planningSource, 'ai');
    assert.deepEqual(body.lockedCoursePlan, report.coursePlan);
    response = { report: { ...report, overview: '我根据补充的课堂观察更新了本次试听总结。', coursePlan: body.lockedCoursePlan } };
  } else if (path === '/api/generate-report-batch') {
    const stage = report.coursePlan.stages[0];
    response = body.operation === 'outline'
      ? { outline: { ...report, rationale: report.coursePlan.rationale, stages: [{ title: stage.title, description: stage.description, lessonCount: 2, startLessonNumber: 1, durations: [1, 1] }] }, targetScore: '5' }
      : { lessons: report.coursePlan.stages.flatMap((item) => item.lessons) };
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
} catch (error) {
  console.error({ errors, apiRequests: requests.map(({ path, method }) => ({ path, method })), history: await page.locator('#history-list').textContent(), examOptions: await page.locator('#ap-exam-date').innerHTML() });
  throw error;
} finally {
  await browser.close();
}
