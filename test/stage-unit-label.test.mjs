import test from 'node:test';
import assert from 'node:assert/strict';
import { stageUnitLabel } from '../public/report/stage-unit-label.js';

test('parent reports show readable official numbering without raw unit codes', () => {
  const stage = (title,...unitCodes) => ({title,lessons:[{unitCodes}]});
  assert.equal(stageUnitLabel('ap_calculus_bc',stage('求导','calc_u4','calc_u3','calc_u4'),10),'Unit 3、4');
  assert.equal(stageUnitLabel('ap_calculus_bc',stage('主学 Unit 4','calc_u4','calc_u3'),10),'主学 Unit 4 · 涉及 Unit 3');
  assert.equal(stageUnitLabel('ap_physics_2',stage('电路','phys2_u3'),7),'Unit 11');
  assert.equal(stageUnitLabel('ap_csp',stage('算法','csp_u3'),5),'');
  assert.equal(stageUnitLabel('ap_calculus_ab',stage('不适用','calc_u10'),8),'');
});
