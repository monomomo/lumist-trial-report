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
