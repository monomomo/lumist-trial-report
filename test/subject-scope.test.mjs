import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSubjectScopeViolation } from '../lib/subjects/scope.ts';

test('AP Calculus AB rejects BC-only modules', () => {
  assert.equal(hasSubjectScopeViolation('ap_calculus_ab', { coursePlan: 'Polar Coordinates and Taylor Series' }), true);
  assert.equal(hasSubjectScopeViolation('ap_calculus_ab', { coursePlan: 'Limits and Continuity, Differentiation, Integration' }), false);
});

test('AP Calculus BC accepts BC modules and rejects other AP subjects', () => {
  assert.equal(hasSubjectScopeViolation('ap_calculus_bc', { coursePlan: 'Parametric Equations, Polar Coordinates, Infinite Sequences and Series' }), false);
  assert.equal(hasSubjectScopeViolation('ap_calculus_bc', { coursePlan: 'AP Computer Science Java recursion' }), true);
});

test('AP economics subjects reject each other exclusive concepts', () => {
  assert.equal(hasSubjectScopeViolation('ap_microeconomics', { coursePlan: 'Aggregate Demand and Monetary Policy' }), true);
  assert.equal(hasSubjectScopeViolation('ap_microeconomics', { coursePlan: 'Supply and Demand, Price Elasticity' }), false);
  assert.equal(hasSubjectScopeViolation('ap_macroeconomics', { coursePlan: 'Monopoly and Consumer Surplus' }), true);
  assert.equal(hasSubjectScopeViolation('ap_macroeconomics', { coursePlan: 'GDP, Inflation, Fiscal Policy' }), false);
});

test('AP Computer Science A rejects calculus modules', () => {
  assert.equal(hasSubjectScopeViolation('ap_csa', { coursePlan: 'Classes, Recursion, Inheritance' }), false);
  assert.equal(hasSubjectScopeViolation('ap_csa', { coursePlan: 'Polar Coordinates and Taylor Series' }), true);
});

test('AP Precalculus allows Calculus and SAT progression without teaching those courses', () => {
  assert.equal(hasSubjectScopeViolation('ap_precalculus', {
    overview: '函数行为与多重表示能力可以衔接 AP Calculus AB/BC，也能迁移到 SAT 数学。',
    coursePlan: 'Polynomial and Rational Functions, Exponential and Logarithmic Functions, Trigonometric and Polar Functions'
  }), false);
  assert.equal(hasSubjectScopeViolation('ap_precalculus', { coursePlan: 'Differentiation, Applications of Derivatives and Integration' }), true);
  assert.equal(hasSubjectScopeViolation('ap_precalculus', { coursePlan: '使用 Bluebook Module 2 和 Student Question Bank 开展 SAT 专项训练' }), true);
});

test('all newly supported subjects reject discipline-specific contamination', () => {
  const contaminatedPlans = {
    ap_chemistry: '安排 Gene Expression and Natural Selection 专项课',
    ap_biology: '讲解 Galvanic Cell and Nernst Equation',
    ap_statistics: '训练 Differentiation and Integration',
    ap_us_history: '按 Global Tapestry 和 Land-Based Empires 排课',
    ap_world_history: '按 Period 1: 1491–1607 排课',
    ap_european_history: '按 Global Tapestry 和 Land-Based Empires 排课',
    ap_psychology: '安排 Aggregate Demand 图像训练',
    ap_human_geography: '讲解 Supreme Court Cases',
    ap_comparative_government: '训练 Foundations of American Democracy',
    ap_art_history: '安排 Harmony and Voice Leading 与 Sight Singing',
    ap_environmental_science: '讲解 Gene Expression and Regulation',
    ap_us_government: '按 Comparative Case Studies 排课',
    ap_chinese: '训练 Latin Reading and Translation',
    ap_seminar: '安排 Bluebook 和 Desmos 专项训练',
    ap_latin: '训练 Presentational Communication 和 Cultural Comparison',
    ap_music_theory: '讲解 Global Prehistory 与 Artistic Attribution',
  };
  for (const [subjectCode, coursePlan] of Object.entries(contaminatedPlans)) {
    assert.equal(hasSubjectScopeViolation(subjectCode, { coursePlan }), true, subjectCode);
  }
});

test('newly supported subjects accept representative in-scope plans', () => {
  const validPlans = {
    ap_chemistry: 'Acids and Bases, Equilibrium, Thermodynamics and Electrochemistry',
    ap_biology: 'Cells, Heredity, Natural Selection and Ecology',
    ap_statistics: 'Sampling Distributions and Inference for Means',
    ap_us_history: 'sourcing, contextualization, DBQ and LEQ',
    ap_world_history: 'Networks of Exchange, Revolutions and Globalization',
    ap_european_history: 'Renaissance, Industrialization and Cold War',
    ap_psychology: 'Cognition, Development and Learning, research methods',
    ap_human_geography: 'Population, migration, spatial patterns and urban land use',
    ap_comparative_government: 'Political Institutions and Comparative Case Studies',
    ap_art_history: 'visual evidence, comparison and cultural context',
    ap_environmental_science: 'Ecosystems, pollution, energy resources and Global Change',
    ap_us_government: 'Foundations of American Democracy and Civil Rights',
    ap_chinese: 'Interpretive Communication and cultural comparison',
    ap_seminar: 'source credibility, multiple perspectives and argument map',
    ap_latin: 'Latin Reading and Translation, syntax and textual evidence',
    ap_music_theory: 'Harmony and Voice Leading, Aural Skills and Sight Singing',
  };
  for (const [subjectCode, coursePlan] of Object.entries(validPlans)) {
    assert.equal(hasSubjectScopeViolation(subjectCode, { coursePlan }), false, subjectCode);
  }
});
