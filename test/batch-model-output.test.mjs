import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOutlineResult, normalizeStageResult } from '../lib/reports/batch-model-output.ts';

const lesson = {
  theme: '语法规则梳理',
  content: '通过代表性题目梳理规则并完成针对性练习',
  difficulty: '从单一规则辨析逐步过渡到综合语境判断',
  goal: '能够独立识别考点并说明选择依据',
};

test('all non-AP subjects discard model-invented unit codes and accept missing codes', () => {
  for (const unitCodes of [undefined, ['Unit 1'], ['sat_rw_u1']]) {
    const result = normalizeStageResult({ lessons: [{ ...lesson, unitCodes }] }, []);
    assert.deepEqual(result.lessons[0].unitCodes, []);
  }
});

test('AP unit codes normalize exact, embedded and human-readable forms without accepting unknown units', () => {
  const allowed = ['ap_biology_u1', 'ap_biology_u2', 'ap_biology_u3'];
  const result = normalizeStageResult({ lessons: [
    { ...lesson, unitCodes: ['AP_BIOLOGY_U1'] },
    { ...lesson, unitCodes: ['ap_biology_u2 Chemistry'] },
    { ...lesson, unitCodes: ['Unit 3'] },
    { ...lesson, unitCodes: ['Unit 9'] },
  ] }, allowed);

  assert.deepEqual(result.lessons.map((item) => item.unitCodes[0]), [
    'ap_biology_u1',
    'ap_biology_u2',
    'ap_biology_u3',
    'Unit 9',
  ]);
});

test('stage normalization trims oversized text for every subject before schema validation', () => {
  const result = normalizeStageResult({ lessons: [{
    theme: `主题${'甲'.repeat(100)}`,
    content: `内容${'乙'.repeat(400)}`,
    difficulty: `难点${'丙'.repeat(400)}`,
    goal: `目标${'丁'.repeat(300)}`,
    unitCodes: [],
  }] }, []);

  assert.equal(result.lessons[0].theme.length, 80);
  assert.equal(result.lessons[0].content.length, 300);
  assert.equal(result.lessons[0].difficulty.length, 300);
  assert.equal(result.lessons[0].goal.length, 200);
});

test('outline normalization trims every bounded field and accepts numeric lesson counts from compatible models', () => {
  const longText = '内容'.repeat(300);
  const result = normalizeOutlineResult({
    overview: longText,
    classroomStatus: longText,
    strength: longText,
    currentFocus: longText,
    lessonTitle: longText,
    lessonSummary: longText,
    performance: longText,
    outcomes: Array.from({ length: 8 }, () => longText),
    priorityAreas: Array.from({ length: 8 }, () => longText),
    rationale: longText,
    stages: [{ title: longText, description: longText, lessonCount: '6' }],
  });

  assert.equal(result.overview.length, 500);
  assert.equal(result.outcomes.length, 5);
  assert.equal(result.priorityAreas.length, 6);
  assert.equal(result.stages[0].title.length, 50);
  assert.equal(result.stages[0].description.length, 100);
  assert.equal(result.stages[0].lessonCount, 6);
});
