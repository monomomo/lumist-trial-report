import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PLANNING_FOCUS_AREAS,
  getPlanningFocusOptions,
  normalizePlanningFocusAreas,
} from '../public/report/planning-context.js';

test('planning focus options hide irrelevant experimental fields by subject', () => {
  const calculusCodes = getPlanningFocusOptions('ap_calculus_bc').map((option) => option.code);
  const biologyCodes = getPlanningFocusOptions('ap_biology').map((option) => option.code);
  assert.equal(calculusCodes.includes('experimental_inquiry'), false);
  assert.equal(calculusCodes.includes('data_analysis'), false);
  assert.equal(biologyCodes.includes('experimental_inquiry'), true);
  assert.equal(biologyCodes.includes('data_analysis'), true);
  assert.equal(calculusCodes.includes('knowledge_foundation'), true);
  assert.equal(calculusCodes.includes('problem_solving'), true);
});

test('planning focus normalization removes duplicates, invalid fields and excess choices', () => {
  const normalized = normalizePlanningFocusAreas([
    'knowledge_foundation',
    'knowledge_foundation',
    'experimental_inquiry',
    'problem_solving',
    'english_terminology',
    'study_habits',
  ], 'ap_calculus_ab');
  assert.deepEqual(normalized, ['knowledge_foundation', 'problem_solving', 'english_terminology']);
  assert.equal(normalized.length, MAX_PLANNING_FOCUS_AREAS);
});
