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
  assert.match(styles, /contain:layout paint; break-inside:avoid-page;/);
  assert.match(styles, /height:296mm !important; min-height:296mm !important; max-height:296mm !important;/);
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

test('student trial summary can be edited and persisted with the report', async () => {
  const source = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/report/styles.css', import.meta.url), 'utf8');

  assert.match(html, /id="edit-summary"/);
  assert.match(html, /id="summary-editor-modal"/);
  assert.match(source, /function openSummaryEditor\(\)/);
  assert.match(source, /Object\.assign\(currentReportData, cloneReportSummary\(draftSummary\)\)/);
  assert.match(source, /renderReport\(currentReportData\)/);
  assert.match(styles, /\.summary-editor-content/);
  assert.match(styles, /\.summary-editor-shell \{[^}]*display:flex;[^}]*flex-direction:column;/);
  assert.match(styles, /\.summary-editor-content \{[^}]*flex:1 1 auto;[^}]*height:0;[^}]*overflow-y:scroll;[^}]*display:flex;[^}]*flex-direction:column;/);
  assert.match(styles, /\.summary-editor-content>\.summary-editor-section \{[^}]*flex:none;/);
  assert.match(styles, /scrollbar-gutter:stable/);
  assert.match(styles, /#edit-summary \{ display:none !important; \}/);
});

test('image-based report cover does not keep the legacy decorative ring', async () => {
  const styles = await readFile(new URL('../public/report/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.cover-page::after \{ display:none; \}/);
  assert.equal(styles.includes('border:80px solid rgba(255,215,46,.85)'), false);
});

test('report headers keep one size and page position across content density modes', async () => {
  const styles = await readFile(new URL('../public/report/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.report-brand-header \{[^}]*width:285px;[^}]*height:69px;[^}]*margin:0 0 18px;/);
  assert.match(styles, /\.summary-page \{ padding:42px 53px 38px; \}/);
  assert.match(styles, /\.teacher-page \{[^}]*padding:42px 53px 38px;/);
  assert.match(styles, /\.reference-plan-page \{ padding:42px 53px 38px;/);
  assert.equal(styles.includes('report-brand-header { width:250px'), false);
  assert.equal(styles.includes('report-brand-header { width:225px'), false);
});

test('high-score case page switches between SAT and AP full-page materials', async () => {
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const htmlSource = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/report/styles.css', import.meta.url), 'utf8');
  assert.match(htmlSource, /id="report-high-score-image"/);
  assert.match(htmlSource, /lumist-sat-high-score-cases\.jpg/);
  assert.match(appSource, /lumist-\$\{track\}-high-score-cases\.jpg/);
  assert.match(appSource, /路觅 2026 \$\{trackLabel\} 学员高分案例/);
  assert.match(styles, /\.sat-results-page \{ padding:0 !important;/);
  assert.match(styles, /\.sat-results-page > img \{[^}]*width:100%;[^}]*height:100%;[^}]*object-fit:cover;/);
});

test('course introduction appears after company introduction as a full-page material', async () => {
  const htmlSource = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/report/styles.css', import.meta.url), 'utf8');
  const coursePageIndex = htmlSource.indexOf('course-introduction-page');
  const companyPageIndex = htmlSource.indexOf('company-page data-impact-page');
  assert.notEqual(coursePageIndex, -1);
  assert.notEqual(companyPageIndex, -1);
  assert.ok(companyPageIndex < coursePageIndex);
  assert.match(htmlSource, /lumist-course-introduction\.jpg/);
  assert.match(styles, /\.course-introduction-page \{ padding:0 !important;/);
  assert.match(styles, /\.course-introduction-page > img \{[^}]*width:100%;[^}]*height:100%;[^}]*object-fit:cover;/);
});

test('company introduction uses an optimized image with a JPEG fallback', async () => {
  const htmlSource = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  assert.match(htmlSource, /lumist-company-introduction\.webp/);
  assert.match(htmlSource, /lumist-company-introduction\.jpeg/);
  assert.match(htmlSource, /width="2380"[\s\S]*height="3368"/);
});

test('new report form starts with empty teacher inputs', async () => {
  const source = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  for (const id of ['student-name', 'target-score', 'total-hours']) {
    const input = source.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] || '';
    assert.equal(input.includes('value='), false);
  }
  assert.match(source, /<textarea id="teacher-notes"[^>]*><\/textarea>/);
  assert.match(source, /id="planning-scenario"/);
  assert.match(source, /id="lesson-count"/);
  assert.equal(source.match(/data-scenario-sample=/g)?.length, 3);
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

test('AP subjects use 5 as the default target score', async () => {
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const routeSource = await readFile(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');

  assert.match(appSource, /目标 AP 成绩（默认 5）/);
  assert.match(appSource, /resolveTargetScore\(currentSubjectCode, \$\('#target-score'\)\.value\)/);
  assert.match(routeSource, /const targetScore = parsed\.data\.targetScore \|\| \(subject\.code\.startsWith\('ap_'\) \? '5' : ''\)/);
  assert.match(routeSource, /promptData = \{[\s\S]*?targetScore,/);
});

test('generation requires a confirmed subject and valid subject scores', async () => {
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const routeSource = await readFile(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');

  assert.match(appSource, /let subjectSelectionConfirmed = true/);
  assert.match(appSource, /subjectSelectionConfirmed = false/);
  assert.match(appSource, /请从下拉列表中选择课程科目/);
  assert.match(appSource, /validateSubjectScores\(/);
  assert.match(appSource, /if \(!validateGenerationInputs\(\)\) return/);
  assert.match(routeSource, /validateSubjectScores\(subject\.code, parsed\.data\.currentScore, targetScore\)/);
  assert.match(routeSource, /error: 'INVALID_SCORE'/);
});

test('course plan hour changes require confirmation and update the form total', async () => {
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /总课时将从 \$\{previousTotalHours\}h 调整为 \$\{draftCoursePlan\.totalHours\}h/);
  assert.match(appSource, /\$\('#total-hours'\)\.value = String\(draftCoursePlan\.totalHours\)/);
  assert.match(appSource, /\$\('#total-hours'\)\.value = String\(currentReportData\.coursePlan\.totalHours\)/);
});

test('generation waits for checklist confirmation and renders a non-blocking quality review', async () => {
  const htmlSource = await readFile(new URL('../public/report/index.html', import.meta.url), 'utf8');
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const routeSource = await readFile(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');

  assert.match(htmlSource, /id="generation-checklist-modal"/);
  assert.match(htmlSource, /确认并生成/);
  assert.match(appSource, /if \(!await openGenerationChecklist\(\)\) return/);
  assert.match(appSource, /buildGenerationChecklist\(/);
  assert.match(appSource, /buildReportQualityChecks\(/);
  assert.match(routeSource, /qualityReview: \{/);
  assert.match(routeSource, /subjectScopePassed: !hasSubjectScopeViolation/);
});

test('parent copy protection applies teacher voice rules to every subject', async () => {
  const source = await readFile(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');
  assert.equal(source.includes("if (subjectCode !== 'sat_math') return report;"), false);
  assert.match(source, /sanitizeParentReport\(modelReport, subject\.code\)/);
  assert.match(source, /getParentVoiceIssues\(report\)/);
  assert.match(source, /上一版报告未通过校验/);
  assert.match(source, /上一版报告：/);
  assert.match(source, /reviewIssues = reviewReport\(modelReport\)/);
  assert.match(source, /REPORT_QUALITY_FAILED/);
  assert.match(source, /generatedLessonCount !== lessonDurations\.length/);
  assert.match(source, /accepted after quality repair with non-structural issues/);
  assert.match(source, /原始课堂记录/);
  assert.match(source, /已知事实/);
  assert.match(source, /无可用/);
  assert.match(source, /第三者口吻/);
  assert.match(source, /本次试听课中，我先了解了学生目前与/);
  assert.match(source, /接下来我会通过具体任务继续观察/);
});

test('lesson durations are computed before generation and attached after validation', async () => {
  const source = await readFile(new URL('../app/api/generate-report/route.ts', import.meta.url), 'utf8');
  assert.match(source, /buildLessonDurationSlots\(parsed\.data\.totalHours, parsed\.data\.lessonCount\)/);
  assert.match(source, /buildUserInput\(subject, promptData\)/);
  assert.match(source, /getCoursePlanQualityIssues\(report, subject\.code, lessonDurations\.length\)/);
  assert.match(source, /applyLessonDurationSlots\(normalizedStages, lessonDurations\)/);
  assert.equal(source.includes('distributeLessonDurations'), false);
  assert.equal(source.includes('duration: z.number()'), false);
  assert.match(source, /content: z\.string\(\)\.min\(8\)\.max\(105\)/);
  assert.match(source, /goal: z\.string\(\)\.min\(8\)\.max\(80\)/);
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
