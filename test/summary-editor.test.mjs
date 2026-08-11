import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneReportSummary, validateReportSummary } from '../public/report/summary-editor-utils.js';

const summary = {
  overview: '我通过本次试听了解了学生目前的学习情况。',
  classroomStatus: '课堂互动积极',
  strength: '基础知识较扎实',
  currentFocus: '需要提升综合应用能力',
  lessonTitle: '函数与图像诊断',
  lessonSummary: '本节课完成了函数表示与图像关系的诊断。',
  performance: '学生能够跟随讲解完成题目。',
  outcomes: ['了解函数图像的基本特征'],
  priorityAreas: ['函数综合应用'],
  coursePlan: { totalHours: 20 },
};

test('summary editor clones only editable report fields', () => {
  const draft = cloneReportSummary(summary);
  draft.outcomes[0] = '已修改';

  assert.equal(summary.outcomes[0], '了解函数图像的基本特征');
  assert.equal('coursePlan' in draft, false);
});

test('summary editor accepts a complete editable summary', () => {
  assert.deepEqual(validateReportSummary(cloneReportSummary(summary)), { valid: true, errors: [] });
});

test('summary editor validates required fields, item counts and maximum lengths', () => {
  const draft = cloneReportSummary(summary);
  draft.overview = '';
  draft.performance = '字'.repeat(301);
  draft.outcomes = [];
  draft.priorityAreas = [''];
  const result = validateReportSummary(draft);

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((error) => error.path), ['overview', 'performance', 'outcomes', 'priorityAreas.0']);
});
