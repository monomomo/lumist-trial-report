import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('report app declares current report state before initialization', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const declarationIndex = source.indexOf('let currentReportData = null;');
  const initializationIndex = source.indexOf('currentReportData = buildFallbackReport');
  assert.notEqual(declarationIndex, -1);
  assert.notEqual(initializationIndex, -1);
  assert.ok(declarationIndex < initializationIndex);
});

test('course plan pagination reserves print safety space', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/report/styles.css', import.meta.url), 'utf8');
  assert.match(source, /CSS_PIXELS_PER_INCH = 96/);
  assert.match(source, /MILLIMETERS_PER_INCH = 25\.4/);
  assert.match(source, /A4_PAGE_HEIGHT_MM = 297/);
  assert.match(source, /PLAN_PAGE_VERTICAL_PADDING = 84/);
  assert.match(source, /PLAN_PAGE_SAFETY_MARGIN = 32/);
  assert.match(source, /body\.scrollHeight > PLAN_PAGE_AVAILABLE_HEIGHT/);
  assert.equal(source.includes('page.clientHeight'), false);
  assert.match(source, /\['plan-page-compact', 'plan-page-condensed'\]/);
  assert.match(styles, /\.plan-measurement-host \.plan-page-body \{ overflow:hidden; \}/);
  assert.equal(styles.includes('.plan-measurement-host .plan-page-body { height:100%'), false);
});

test('summary page compacts and splits by measured A4 content height', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/report/styles.css', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  assert.match(html, /class="summary-page-content"/);
  assert.match(html, /class="summary-profile-section"/);
  assert.match(html, /class="summary-learning-section"/);
  assert.match(source, /function layoutSummaryPages\(\)/);
  assert.match(source, /summary-page-compact/);
  assert.match(source, /summary-page-condensed/);
  assert.match(source, /summary-continuation-page/);
  assert.match(source, /scrollHeight <= PLAN_PAGE_AVAILABLE_HEIGHT/);
  assert.match(source, /summaryPageCount \+ planPageCount \+ 1/);
  assert.match(styles, /\.summary-measurement-host/);
});

test('new report form starts with empty teacher inputs', async () => {
  const source = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  for (const id of ['student-name', 'target-score', 'total-hours']) {
    const input = source.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] || '';
    assert.equal(input.includes('value='), false);
  }
  assert.match(source, /<textarea id="teacher-notes"[^>]*><\/textarea>/);
  assert.match(source, /id="sample-one"/);
  assert.match(source, /id="sample-two"/);
});

test('AP subjects use upcoming May exam options', async () => {
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const htmlSource = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  assert.match(htmlSource, /id="ap-exam-date"/);
  assert.match(appSource, /subjectCode\.startsWith\('ap_'\)/);
  assert.match(appSource, /new Date\(\)\.getFullYear\(\) \+ 1/);
  assert.match(appSource, /Array\.from\(\{ length: 5 \}/);
  assert.match(appSource, /`\$\{year\}年5月`/);
});

test('parent copy protection applies teacher voice rules to every subject', async () => {
  const source = await readFile(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');
  assert.equal(source.includes("if (subjectCode !== 'sat_math') return report;"), false);
  assert.match(source, /sanitizeParentReport\(modelReport, subject\.code\)/);
  assert.match(source, /getParentVoiceIssues\(modelReport\)/);
  assert.match(source, /以任课老师本人向家长反馈的口吻重写家长可见内容/);
  assert.match(source, /原始课堂记录/);
  assert.match(source, /已知事实/);
  assert.match(source, /无可用/);
  assert.match(source, /第三者口吻/);
  assert.match(source, /本次试听课中，我先了解了学生目前与/);
  assert.match(source, /接下来我会通过具体任务继续观察/);
});

test('priority areas preserve complete bilingual subject terms', async () => {
  const routeSource = await readFile(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/report/styles.css', import.meta.url), 'utf8');
  assert.match(routeSource, /priorityAreas: z\.array\(z\.string\(\)\.min\(2\)\.max\(80\)\)/);
  assert.match(routeSource, /parentReport\.priorityAreas\.map\(normalizePlanTitle\)/);
  assert.match(styles, /\.needs-list span \{ max-width:100%; line-height:1\.45; overflow-wrap:anywhere; white-space:normal; \}/);
});

test('generated lessons cannot fail the whole report for page length', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("throw new Error('COURSE_PLAN_LESSON_TOO_LONG')"), false);
  assert.equal(source.includes('COURSE_PLAN_LESSON_TOO_LONG:'), false);
});
