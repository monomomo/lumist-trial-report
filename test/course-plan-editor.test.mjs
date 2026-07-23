import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloneCoursePlan,
  calculateTotalHours,
  validateCoursePlan,
  moveItem,
  moveLesson,
  rebalanceFinalPage,
  createStage,
  createLesson
} from '../public/report/course-plan-utils.js';

const plan = {
  totalHours: 2.5,
  rationale: '按学情动态调整',
  stages: [
    {
      title: '基础阶段',
      description: '恢复知识框架',
      lessons: [
        { duration: 1, theme: '代数', content: '方程', goal: '掌握方程', difficulty: '含参方程' },
        { duration: 1.5, theme: '几何', content: '三角形', goal: '掌握定理', difficulty: '综合应用' }
      ]
    },
    { title: '冲刺阶段', description: '套题训练', lessons: [{ duration: 0.5, theme: '模考', content: '限时', goal: '稳定发挥', difficulty: '时间管理' }] }
  ]
};

test('cloneCoursePlan creates an independent deep copy', () => {
  const copy = cloneCoursePlan(plan);
  copy.stages[0].lessons[0].theme = '已修改';
  assert.equal(plan.stages[0].lessons[0].theme, '代数');
});

test('calculateTotalHours sums supported fractional durations', () => {
  assert.equal(calculateTotalHours(plan), 3);
});

test('validateCoursePlan reports required fields, invalid durations and empty stages', () => {
  const invalid = cloneCoursePlan(plan);
  invalid.stages[0].title = ' ';
  invalid.stages[0].lessons[0].duration = 3;
  invalid.stages[0].lessons[0].goal = '';
  invalid.stages[1].lessons = [];
  const result = validateCoursePlan(invalid);
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((item) => item.path), [
    'stages.0.title',
    'stages.0.lessons.0.duration',
    'stages.0.lessons.0.goal',
    'stages.1.lessons'
  ]);
});

test('validateCoursePlan allows an optional stage description', () => {
  const withoutDescription = cloneCoursePlan(plan);
  withoutDescription.stages[0].description = '';
  const result = validateCoursePlan(withoutDescription);
  assert.equal(result.valid, true);
  assert.equal(result.errors.some((item) => item.path === 'stages.0.description'), false);
});

test('validateCoursePlan uses exact warning boundaries for every editable text field', () => {
  const boundaries = [
    ['stages.0.title', 50],
    ['stages.0.description', 160],
    ['stages.0.lessons.0.theme', 60],
    ['stages.0.lessons.0.content', 300],
    ['stages.0.lessons.0.goal', 180],
    ['stages.0.lessons.0.difficulty', 180]
  ];
  const setValue = (target, path, value) => {
    const parts = path.split('.');
    let current = target;
    parts.slice(0, -1).forEach((part) => { current = current[Number.isNaN(Number(part)) ? part : Number(part)]; });
    current[parts.at(-1)] = value;
  };
  boundaries.forEach(([path, limit]) => {
    const atLimit = cloneCoursePlan(plan);
    setValue(atLimit, path, '字'.repeat(limit));
    assert.equal(validateCoursePlan(atLimit).warnings.some((item) => item.path === path), false, `${path} should allow ${limit}`);
    const overLimit = cloneCoursePlan(plan);
    setValue(overLimit, path, '字'.repeat(limit + 1));
    assert.equal(validateCoursePlan(overLimit).warnings.some((item) => item.path === path), true, `${path} should warn at ${limit + 1}`);
  });
});

test('validateCoursePlan blocks a stage left empty after deleting its last lesson', () => {
  const emptyStage = cloneCoursePlan(plan);
  emptyStage.stages[1].lessons.splice(0, 1);
  const result = validateCoursePlan(emptyStage);
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.filter((item) => item.path === 'stages.1.lessons'), [
    { path: 'stages.1.lessons', message: '每个阶段至少需要一个课时' }
  ]);
});

test('validateCoursePlan blocks a plan without stages', () => {
  const result = validateCoursePlan({ totalHours: 0, stages: [] });
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [{ path: 'stages', message: '课程规划至少需要一个阶段' }]);
});

test('moveItem reorders items without mutating the source', () => {
  const source = ['a', 'b', 'c'];
  assert.deepEqual(moveItem(source, 1, 0), ['b', 'a', 'c']);
  assert.deepEqual(source, ['a', 'b', 'c']);
  assert.deepEqual(moveItem(source, 0, -1), source);
});

test('moveLesson moves a lesson across stages and preserves the original plan', () => {
  const moved = moveLesson(plan, 0, 1, 1, 1);
  assert.deepEqual(moved.stages[0].lessons.map((item) => item.theme), ['代数']);
  assert.deepEqual(moved.stages[1].lessons.map((item) => item.theme), ['模考', '几何']);
  assert.equal(plan.stages[0].lessons.length, 2);
});

test('rebalanceFinalPage works backward and moves only when the measured target fits', () => {
  const pages = [['01', '02', '03'], ['04', '05'], ['06']];
  const balanced = rebalanceFinalPage(pages, (pageIndex, rows) => pageIndex !== 2 || rows.length <= 2);
  assert.deepEqual(balanced, [['01', '02'], ['03', '04'], ['05', '06']]);
});

test('rebalanceFinalPage gives an ordinary final page two lessons when physically feasible', () => {
  const pages = [['01', '02', '03'], ['04']];
  const balanced = rebalanceFinalPage(pages, (_pageIndex, rows) => rows.length <= 2);
  assert.deepEqual(balanced, [['01', '02'], ['03', '04']]);
});

test('rebalanceFinalPage leaves rows in place when moving would overflow', () => {
  const pages = [['01', '02', '03'], ['04']];
  const balanced = rebalanceFinalPage(pages, (pageIndex, rows) => pageIndex !== 1 || rows.length === 1);
  assert.deepEqual(balanced, pages);
});

test('rebalanceFinalPage revisits the tail after an earlier page receives a lesson', () => {
  const pages = [['01', '02', '03'], ['04'], ['05']];
  const balanced = rebalanceFinalPage(pages, (_pageIndex, rows) => rows.length <= 2);
  assert.deepEqual(balanced.at(-1), ['04', '05']);
});

test('factory functions provide valid editable structures', () => {
  assert.deepEqual(createStage(), { title: '新阶段', description: '', lessons: [createLesson()] });
  assert.deepEqual(createLesson(), { duration: 1, theme: '', content: '', goal: '', difficulty: '' });
});
