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
  assert.match(review.hardIssues.join('；'), /不允许的 Unit：calc_u9/);
  assert.match(review.hardIssues.join('；'), /calc_u3/);
});

test('BC intensive coverage accepts all units and checks exam practice components', () => {
  const allUnits = Array.from({ length: 10 }, (_, index) => [`calc_u${index + 1}`]);
  const complete = reviewCalculusSyllabusCoverage(createReport(allUnits), 'ap_calculus_bc', 'intensive', '');
  assert.deepEqual(complete, { hardIssues: [], warnings: [] });
  const incomplete = reviewCalculusSyllabusCoverage(createReport(allUnits.slice(0, 8), '完成概念练习'), 'ap_calculus_bc', 'intensive', '');
  assert.match(incomplete.hardIssues.join('；'), /calc_u9、calc_u10/);
  assert.deepEqual(incomplete.warnings.length, 4);
});
