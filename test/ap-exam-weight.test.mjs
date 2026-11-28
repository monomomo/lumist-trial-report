import test from 'node:test';
import assert from 'node:assert/strict';
import { formatApStageExamWeight, getApExamWeightProfile, inferApSectionCodes, verifyApExamWeightCoverage } from '../lib/subjects/ap-exam-weight.ts';
import { SUBJECT_CATALOG } from '../lib/subjects/catalog.js';

test('every supported AP subject has an official exam weight profile', () => {
  assert.deepEqual(verifyApExamWeightCoverage(), []);
});

test('unit and skill based AP subjects expose stage-specific official weights', () => {
  assert.match(formatApStageExamWeight('ap_chemistry', ['chem_u3']), /U3 18%–22%/);
  assert.match(formatApStageExamWeight('ap_english_language', ['lang_u3']), /Claims and Evidence: Reading 13%–16%/);
  assert.match(formatApStageExamWeight('ap_calculus_bc', ['calc_u10']), /U10 15%–20%/);
});

test('assessment based AP subjects use official exam composition without inventing unit weights', () => {
  assert.match(formatApStageExamWeight('ap_chinese', ['chn_u2']), /听力 25%；阅读 25%/);
  assert.match(formatApStageExamWeight('ap_seminar', ['seminar_u3']), /期末考试 45%/);
  assert.equal(formatApStageExamWeight('ap_business_personal_finance', ['bpf_u5']), 'Unit 5 不纳入 AP Exam');
  assert.equal(getApExamWeightProfile('sat_math'), null);
});

test('uploaded AP plans can infer official sections from unit numbers and exact titles', () => {
  assert.deepEqual(inferApSectionCodes('ap_chemistry', 'Unit 3 Properties of Substances and Mixtures'), ['chem_u3']);
  assert.deepEqual(inferApSectionCodes('ap_csp', 'Big Idea 2: Data'), ['csp_u2']);
  assert.deepEqual(inferApSectionCodes('sat_math', 'Unit 3'), []);
});

test('every supported AP subject produces a PDF-safe official weight summary', () => {
  for (const [subjectCode, subject] of Object.entries(SUBJECT_CATALOG).filter(([code]) => code.startsWith('ap_'))) {
    const codes = inferApSectionCodes(subjectCode, subject.modules.join('\n'));
    const summary = formatApStageExamWeight(subjectCode, codes);
    assert.ok(summary, subjectCode);
    assert.ok(summary.length <= 160, `${subjectCode}: ${summary.length}`);
  }
});
