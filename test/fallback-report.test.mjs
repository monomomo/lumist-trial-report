import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFallbackReport, resolveTargetScore } from '../public/report/report-domain.js';
import { SUBJECT_CODES } from '../public/report/catalog.js';

const baseForm = {
  studentName: '小王',
  currentScore: '',
  targetScore: '',
  examDate: '',
  teacherNotes: '学生课堂互动积极，能够完成部分中等难度题目，需要继续确认各模块掌握情况。',
};

test('fallback plans honor the requested total hours for every subject', () => {
  for (const subjectCode of SUBJECT_CODES) {
    for (const totalHours of [2, 2.5, 30, 50, 60]) {
      const report = buildFallbackReport(subjectCode, { ...baseForm, totalHours: String(totalHours) });
      const lessons = report.coursePlan.stages.flatMap((stage) => stage.lessons);
      const plannedHours = lessons.reduce((sum, lesson) => sum + lesson.duration, 0);

      assert.equal(report.coursePlan.totalHours, totalHours);
      assert.equal(plannedHours, totalHours);
      assert.equal(lessons.length, Math.ceil(totalHours / 2));
      assert.equal(lessons.every((lesson) => [0.5, 1, 1.5, 2].includes(lesson.duration)), true);
    }
  }
});

test('fallback parent-facing copy uses the teacher voice', () => {
  const report = buildFallbackReport('ap_calculus_bc', { ...baseForm, totalHours: '20' });
  const parentFacingText = [
    report.overview,
    report.classroomStatus,
    report.strength,
    report.currentFocus,
    report.lessonSummary,
    report.performance,
    ...report.outcomes,
  ].join('\n');

  assert.match(report.overview, /我/);
  assert.match(report.currentFocus, /我/);
  assert.doesNotMatch(parentFacingText, /本报告|原始记录|任课老师|教师/);
});

test('fallback uses the selected scenario and editable lesson count', () => {
  const report = buildFallbackReport('ap_calculus_bc', {
    ...baseForm,
    totalHours: '30',
    lessonCount: '20',
    planningScenario: 'intensive',
  });
  const lessons = report.coursePlan.stages.flatMap((stage) => stage.lessons);
  assert.deepEqual(report.planningContext, { scenario: 'intensive', lessonCount: 20, focusAreas: [] });
  assert.equal(lessons.length, 20);
  assert.equal(lessons.reduce((sum, lesson) => sum + lesson.duration, 0), 30);
});

test('fallback preserves valid planning focus areas without inventing others', () => {
  const report = buildFallbackReport('ap_biology', {
    ...baseForm,
    totalHours: '20',
    planningFocusAreas: ['experimental_inquiry', 'data_analysis'],
  });
  assert.deepEqual(report.planningContext.focusAreas, ['experimental_inquiry', 'data_analysis']);
});

test('fallback uses 30 hours only when the submitted value is invalid', () => {
  for (const totalHours of ['', '1', '60.5', 'abc']) {
    const report = buildFallbackReport('sat_math', { ...baseForm, totalHours });
    assert.equal(report.coursePlan.totalHours, 30);
  }
});

test('AP subjects default an empty target score to 5', () => {
  for (const subjectCode of SUBJECT_CODES.filter((code) => code.startsWith('ap_'))) {
    assert.equal(resolveTargetScore(subjectCode, ''), '5');
    assert.equal(buildFallbackReport(subjectCode, { ...baseForm, totalHours: '20' }).target, '5');
  }

  assert.equal(resolveTargetScore('sat_math', ''), '');
  assert.equal(buildFallbackReport('sat_math', { ...baseForm, totalHours: '20' }).target, '待老师确认');
  assert.equal(resolveTargetScore('ap_calculus_bc', '4'), '4');
});
