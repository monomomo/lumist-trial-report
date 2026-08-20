import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCalculusSyllabusPrompt,
  extractExplicitCalculusUnits,
  getCalculusUnits,
  getRequiredCalculusUnits,
  reviewCalculusSyllabusCoverage,
} from '../lib/subjects/ap-calculus-syllabus.js';

function createReport(unitCodes, text = '完成 MCQ、FRQ、模考与错因复盘') {
  return {
    coursePlan: {
      stages: [{
        lessons: unitCodes.map((codes, index) => ({
          duration: 1,
          unitCodes: codes,
          theme: `Calculus Unit ${index + 1}`,
          content: text,
        })),
      }],
    },
  };
}

test('AP Calculus AB and BC expose the official unit boundaries and weights', () => {
  const ab = getCalculusUnits('ap_calculus_ab');
  const bc = getCalculusUnits('ap_calculus_bc');
  assert.equal(ab.length, 8);
  assert.equal(bc.length, 10);
  assert.deepEqual(ab.map((unit) => unit.code), Array.from({ length: 8 }, (_, index) => `calc_u${index + 1}`));
  assert.deepEqual(bc.slice(-2).map((unit) => unit.code), ['calc_u9', 'calc_u10']);
  assert.deepEqual(ab.find((unit) => unit.code === 'calc_u6').examWeight, { minimum: 15, maximum: 20 });
  assert.deepEqual(bc.find((unit) => unit.code === 'calc_u10').examWeight, { minimum: 17, maximum: 18 });
});

test('scenario requirements use explicit units, preview foundations, and full intensive coverage', () => {
  assert.deepEqual(extractExplicitCalculusUnits('学校正在学习 Unit 4，并复习 U2。', 'ap_calculus_ab'), ['calc_u4', 'calc_u2']);
  assert.deepEqual(getRequiredCalculusUnits('ap_calculus_ab', 'preview', ''), ['calc_u1', 'calc_u2', 'calc_u3']);
  assert.deepEqual(getRequiredCalculusUnits('ap_calculus_ab', 'synchronous', '校内 Unit 5'), ['calc_u5']);
  assert.equal(getRequiredCalculusUnits('ap_calculus_bc', 'intensive', '').length, 10);
});

test('calculus syllabus prompt lists only units allowed by the selected course', () => {
  const ab = buildCalculusSyllabusPrompt('ap_calculus_ab', 'intensive', '');
  const bc = buildCalculusSyllabusPrompt('ap_calculus_bc', 'intensive', '');
  assert.equal(ab.allowedUnits.some((unit) => unit.code === 'calc_u9'), false);
  assert.equal(bc.allowedUnits.some((unit) => unit.code === 'calc_u10'), true);
  assert.equal(buildCalculusSyllabusPrompt('ap_biology', 'intensive', ''), null);
});

test('AB rejects BC-only unit markers and preview requires foundational units', () => {
  const report = createReport([['calc_u1'], ['calc_u2'], ['calc_u9']]);
  const review = reviewCalculusSyllabusCoverage(report, 'ap_calculus_ab', 'preview', '');
  assert.match(review.hardIssues.join('；'), /当前课程不包含的第 9 单元（参数方程、极坐标与向量值函数）/);
  assert.match(review.hardIssues.join('；'), /第 3 单元（复合函数、隐函数与反函数求导）/);
});

test('BC intensive coverage accepts all units and checks exam practice components', () => {
  const allUnits = Array.from({ length: 10 }, (_, index) => [`calc_u${index + 1}`]);
  const complete = reviewCalculusSyllabusCoverage(createReport(allUnits), 'ap_calculus_bc', 'intensive', '');
  assert.deepEqual(complete, { hardIssues: [], warnings: [] });
  const incomplete = reviewCalculusSyllabusCoverage(createReport(allUnits.slice(0, 8), '完成概念练习'), 'ap_calculus_bc', 'intensive', '');
  assert.match(incomplete.hardIssues.join('；'), /第 9 单元（参数方程、极坐标与向量值函数）、第 10 单元（无穷数列与级数）/);
  assert.deepEqual(incomplete.warnings.length, 4);
});

test('semantic review rejects lessons whose content and unit markers disagree', () => {
  const report = {
    coursePlan: {
      stages: [{
        title: '积分与微分方程',
        lessons: [
          { theme: 'Riemann Sum 与定积分', content: '使用 Riemann sum 解释定积分', unitCodes: ['calc_u1'] },
          { theme: 'Separable Differential Equations', content: '使用变量分离求解微分方程', unitCodes: ['calc_u3'] },
        ],
      }],
    },
  };
  const review = reviewCalculusSyllabusCoverage(report, 'ap_calculus_ab', 'synchronous', '');
  const issues = review.hardIssues.join('；');
  assert.match(issues, /第 6 单元（积分与变化的累积）/);
  assert.match(issues, /第 7 单元（微分方程）/);
  assert.match(issues, /明确内容与该单元不一致/);
  assert.doesNotMatch(issues, /calc_u|unitCodes|Unit/);
});

test('preview cannot expand beyond required units and stage claims must match actual coverage', () => {
  const report = {
    coursePlan: {
      stages: [{
        title: '阶段检测（覆盖 Units 1–3）',
        description: '完成 Units 1–3 的总结与检测',
        lessons: [
          { theme: 'Limits', content: '完成 limit 基础练习', unitCodes: ['calc_u1'] },
          { theme: 'Derivative definition', content: '用 difference quotient 解释导数定义', unitCodes: ['calc_u2'] },
          { theme: 'Chain Rule', content: '使用 chain rule 求复合函数导数', unitCodes: ['calc_u3'] },
          { theme: 'Optimization', content: '完成 optimization 建模', unitCodes: ['calc_u5'] },
        ],
      }],
    },
  };
  const review = reviewCalculusSyllabusCoverage(report, 'ap_calculus_ab', 'preview', '');
  assert.match(review.hardIssues.join('；'), /阶段写明覆盖/);
  assert.match(review.hardIssues.join('；'), /预习规划超出/);
});

test('fixed unit assessment promises are rejected', () => {
  const report = createReport([['calc_u1'], ['calc_u2'], ['calc_u3']]);
  report.coursePlan.stages[0].description = '每完成 2 个 Unit 后安排一次阶段测评';
  const review = reviewCalculusSyllabusCoverage(report, 'ap_calculus_ab', 'preview', '');
  assert.match(review.hardIssues.join('；'), /每学完固定数量的单元就测评/);
});
