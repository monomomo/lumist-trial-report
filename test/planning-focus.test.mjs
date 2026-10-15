import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PLANNING_FOCUS_AREAS,
  getPlanningScenarioSample,
  getPlanningFocusOptions,
  normalizePlanningFocusAreas,
} from '../public/report/planning-context.js';

test('SAT subjects use subject-specific planning samples while AP keeps the shared samples', () => {
  assert.match(getPlanningScenarioSample('preview', 'sat_math'), /SAT 数学/);
  assert.match(getPlanningScenarioSample('synchronous', 'sat_math'), /Advanced Math/);
  assert.match(getPlanningScenarioSample('intensive', 'sat_math'), /Desmos/);
  assert.match(getPlanningScenarioSample('preview', 'sat_english'), /SAT 英语/);
  assert.match(getPlanningScenarioSample('synchronous', 'sat_english'), /Craft and Structure/);
  assert.match(getPlanningScenarioSample('intensive', 'sat_english'), /Standard English Conventions|语法/);
  assert.match(getPlanningScenarioSample('preview', 'ap_calculus_ab'), /AP 课程/);
});

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
