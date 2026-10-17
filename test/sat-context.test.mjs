import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAT_MATH_AREA_CODES,
  buildSatMathLessonAllocations,
  suggestSatMathHours,
  sumSatMathHours,
  validateSatEnglishAssessment,
  validateSatMathHours,
} from '../public/report/sat-context.js';

test('SAT math suggestions preserve the requested total with integrated practice', () => {
  for (const total of [2, 7.5, 20, 37.5, 60]) {
    const suggestion = suggestSatMathHours(total);
    assert.ok(suggestion);
    assert.equal(sumSatMathHours(suggestion), total);
    assert.ok(suggestion.integrated_practice >= 0.5);
    assert.equal(validateSatMathHours(suggestion, total).valid, true);
  }
});

test('SAT math validation distinguishes blanks from an explicit zero', () => {
  const complete = {
    algebra: 4,
    advanced_math: 4,
    problem_solving_data_analysis: 1,
    geometry_trigonometry: 1,
    integrated_practice: 2,
  };
  assert.equal(validateSatMathHours({ ...complete, geometry_trigonometry: '' }, 12).valid, false);
  assert.equal(validateSatMathHours({ ...complete, geometry_trigonometry: 0 }, 11).valid, true);
});

test('SAT math lesson allocations preserve every locked area hour', () => {
  const hours = {
    algebra: 3,
    advanced_math: 2,
    problem_solving_data_analysis: 1,
    geometry_trigonometry: 1,
    integrated_practice: 1,
  };
  const allocations = buildSatMathLessonAllocations(hours, [2, 1.5, 2, 1, 1.5]);
  assert.equal(allocations.length, 5);
  const totals = Object.fromEntries(SAT_MATH_AREA_CODES.map((code) => [code, 0]));
  allocations.flat().forEach((item) => { totals[item.code] += item.hours; });
  assert.deepEqual(totals, hours);
  allocations.forEach((lesson, index) => {
    assert.equal(lesson.reduce((total, item) => total + item.hours, 0), [2, 1.5, 2, 1, 1.5][index]);
  });
});

test('SAT English assessment accepts current TOEFL and IELTS formats', () => {
  assert.equal(validateSatEnglishAssessment({ testType: 'toefl_ibt', scoreScale: 'new_1_6', overallScore: '5', readingScore: '4.5' }).valid, true);
  assert.equal(validateSatEnglishAssessment({ testType: 'toefl_ibt', scoreScale: 'legacy_0_120', overallScore: '105', readingScore: '28' }).valid, true);
  assert.equal(validateSatEnglishAssessment({ testType: 'ielts_academic', overallScore: '7.5', readingScore: '8' }).valid, true);
  assert.equal(validateSatEnglishAssessment({ testType: 'toefl_ibt', scoreScale: 'new_1_6', overallScore: '100' }).valid, false);
  assert.equal(validateSatEnglishAssessment({ testType: 'ielts_academic', overallScore: '7.3' }).valid, false);
});
