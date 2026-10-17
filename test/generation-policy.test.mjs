import test from 'node:test';
import assert from 'node:assert/strict';
import { getGenerationAction, normalizeGenerationInput, sameCoursePlan } from '../public/report/generation-policy.js';
import { generationSnapshotSchema } from '../lib/reports/generation-snapshot-schema.js';

const input = {
  source: 'ai',
  subjectCode: 'ap_calculus_ab',
  studentName: '小林',
  currentScore: '3',
  targetScore: '5',
  examDate: '2027年5月',
  totalHours: 10,
  lessonCount: 5,
  planningScenario: 'synchronous',
  planningFocusAreas: ['knowledge_foundation', 'problem_solving'],
  includeExamTraining: false,
  teacherNotes: '本次课堂完成函数分析，学生能解释图像特征，但对定义域的判断还需练习。',
};

test('identical input reuses results despite field ordering, whitespace and numeric form values', () => {
  const repeated = { ...input, totalHours: '10', lessonCount: '5', studentName: ' 小林 ', planningFocusAreas: [...input.planningFocusAreas].reverse() };
  assert.equal(getGenerationAction(input, repeated), 'reuse');
  assert.equal(getGenerationAction(input, input, { forceNewPlan: true }), 'new-plan');
  assert.equal(getGenerationAction(null, input), 'new-plan');
});

test('changing only feedback or the student display name preserves the plan', () => {
  assert.equal(getGenerationAction(input, { ...input, teacherNotes: input.teacherNotes + '补充：能独立检查边界条件。' }), 'summary-only');
  assert.equal(getGenerationAction(input, { ...input, studentName: '林同学' }), 'summary-only');
});

test('every meaningful planning constraint invalidates preservation', () => {
  for (const [field, value] of Object.entries({
    source: 'upload', subjectCode: 'ap_calculus_bc', currentScore: '4', targetScore: '4',
    examDate: '2028年5月', totalHours: 12, lessonCount: 6, planningScenario: 'intensive',
    planningFocusAreas: [], includeExamTraining: true,
  })) {
    assert.equal(getGenerationAction(input, { ...input, [field]: value }), 'new-plan', field);
  }
});

test('SAT language assessments and domain hours are planning constraints', () => {
  const english = { ...input, subjectCode: 'sat_english', satEnglishAssessment: { testType: 'ielts_academic', scoreScale: 'ielts_0_9', overallScore: 7 } };
  assert.equal(getGenerationAction(english, { ...english, satEnglishAssessment: { ...english.satEnglishAssessment, overallScore: 8 } }), 'new-plan');
  const math = { ...input, subjectCode: 'sat_math', satMathHours: { algebra: 4, advanced_math: 4, problem_solving_data_analysis: 1, geometry_trigonometry: 1, integrated_practice: 0 } };
  assert.equal(getGenerationAction(math, { ...math, satMathHours: { ...math.satMathHours, algebra: 3, advanced_math: 5 } }), 'new-plan');
  assert.equal(getGenerationAction(math, { ...math, teacherNotes: '学生在课堂上能解释一次函数图像，但解方程时容易漏掉符号，需要继续练习。' }), 'summary-only');
});

test('upload snapshots ignore unused AI planning fields', () => {
  const upload = { ...input, source: 'upload' };
  assert.equal(getGenerationAction(upload, { ...upload, planningFocusAreas: [], planningScenario: 'preview', includeExamTraining: true }), 'reuse');
});

test('locked-plan equality detects text, duration and ordering changes without mutating either plan', () => {
  const plan = { totalHours: 2, rationale: '课程安排', stages: [{ title: '基础', lessons: [{ duration: 1, theme: '函数' }, { duration: 1, theme: '方程' }] }] };
  const copy = structuredClone(plan);
  assert.equal(sameCoursePlan(plan, copy), true);
  copy.stages[0].lessons.reverse();
  assert.equal(sameCoursePlan(plan, copy), false);
  copy.stages[0].lessons.reverse();
  copy.stages[0].lessons[0].theme = '新课程';
  assert.equal(sameCoursePlan(plan, copy), false);
  assert.equal(plan.stages[0].lessons[0].theme, '函数');
  assert.equal(sameCoursePlan({ ...plan, rationale: '' }, { ...plan, rationale: '本课程规划由任课老师上传并确认，课次顺序、课程内容与时长均按原文件保留。' }), true);
});

test('normalized generation snapshots validate before persistence and reject malformed constraints', () => {
  const normalized = normalizeGenerationInput({ ...input, planningFocusAreas: ['knowledge_foundation'] });
  assert.equal(generationSnapshotSchema.safeParse(normalized).success, true);
  assert.equal(generationSnapshotSchema.safeParse({ ...normalized, totalHours: 0 }).success, false);
  assert.equal(generationSnapshotSchema.safeParse({ ...normalized, source: 'other' }).success, false);
  assert.equal(generationSnapshotSchema.safeParse({ ...normalized, teacherNotes: '' }).success, false);
});
