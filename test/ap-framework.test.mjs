import test from 'node:test';
import assert from 'node:assert/strict';
import { SUBJECT_CODES } from '../lib/subjects/catalog.js';
import { buildApFrameworkPrompt, getApFramework, reviewApFrameworkCodes } from '../lib/subjects/ap-framework.ts';

const AP_CODES = SUBJECT_CODES.filter((code) => code.startsWith('ap_'));

test('every supported AP course has a dated catalog snapshot and official source', () => {
  for (const code of AP_CODES) {
    const framework = getApFramework(code);
    assert.equal(framework.catalogSnapshot, '2026-10-02', code);
    assert.equal(framework.effectiveSchoolYear, '2026-27', code);
    assert.match(framework.source, /^https:\/\/apcentral\.collegeboard\.org\/courses\//, code);
    assert.equal(framework.sources.every((source) => source.startsWith('https://apcentral.collegeboard.org/courses/')), true, code);
    assert.equal(framework.sections.length >= 4, true, code);
    assert.equal(framework.practices.length >= 2, true, code);
    assert.equal(new Set(framework.sections.map((section) => section.code)).size, framework.sections.length, code);
  }
});

test('revised AP frameworks keep units, practices, and assessment rules separate', () => {
  const statistics = getApFramework('ap_statistics');
  assert.equal(statistics.sections.length, 5);
  assert.deepEqual(statistics.practices, ['Formulate Questions', 'Collect Data', 'Analyze Data', 'Interpret Results']);
  assert.match(statistics.subjectRules.join('；'), /inference for slopes/i);

  const csp = getApFramework('ap_csp');
  assert.equal(csp.sections.length, 5);
  assert.equal(csp.sections.some((section) => /Create Performance Task/.test(section.title)), false);
  assert.match(csp.subjectRules.join('；'), /through-course assessment/);

  const precalculus = getApFramework('ap_precalculus');
  assert.match(precalculus.subjectRules.join('；'), /Unit 4.+不纳入 AP Exam/);

  const worldHistory = getApFramework('ap_world_history');
  assert.equal(worldHistory.source, 'https://apcentral.collegeboard.org/courses/ap-world-history');

  const combinedEconomics = getApFramework('ap_micro_macro_economics');
  assert.equal(combinedEconomics.sources.length, 2);
});

test('AP Business with Personal Finance preserves official unit numbering and skill categories', () => {
  const framework = getApFramework('ap_business_personal_finance');
  assert.deepEqual(framework.sections.map((section) => section.code), ['bpf_u1', 'bpf_u2', 'bpf_u3', 'bpf_u4', 'bpf_u5']);
  assert.match(framework.sections[2].title, /Personal Saving and Borrowing.+Business Finance and Accounting/);
  assert.deepEqual(framework.practices, ['Concept application', 'Entrepreneurship', 'Decision making', 'Communication', 'Collaboration']);
});

test('every AP prompt receives allowed framework sections and practices', () => {
  for (const code of AP_CODES) {
    const syllabus = buildApFrameworkPrompt(code);
    assert.equal(syllabus.allowedSections.length >= 4, true, code);
    assert.equal(syllabus.practices.length >= 2, true, code);
    assert.match(syllabus.rules.join('；'), /unitCodes/);
    assert.match(syllabus.rules.join('；'), /不按百分比机械分配课时/);
  }
});

test('AP framework review requires valid section codes on every lesson', () => {
  const report = { coursePlan: { stages: [{ lessons: [{ unitCodes: ['bio_u1'] }, { unitCodes: [] }, { unitCodes: ['macro_u2'] }] }] } };
  const issues = reviewApFrameworkCodes(report, 'ap_biology').join('；');
  assert.match(issues, /第 2 节课尚未关联/);
  assert.match(issues, /第 3 节课包含/);
  assert.equal(reviewApFrameworkCodes(report, 'sat_math').length, 0);
});
