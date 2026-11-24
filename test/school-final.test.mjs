import test from 'node:test';
import assert from 'node:assert/strict';
import { isSchoolFinal, schoolFinalPlacement } from '../public/report/school-final.js';

test('only an unambiguous school final is inserted between exam preparation and review', () => {
  const exam = {name:'校内 Final',date:'2026-12-18'};
  const stages = [{title:'校内期末考前复习：化学平衡'},{title:'校内期末考后复盘'},{title:'AP 酸碱'}];
  assert.equal(isSchoolFinal(exam),true);
  assert.equal(isSchoolFinal({name:'月考'}),false);
  assert.equal(schoolFinalPlacement(exam,[exam],stages,'2027年5月'),1);
  assert.equal(schoolFinalPlacement({...exam,date:''},[exam],stages,'2027年5月'),-1);
  assert.equal(schoolFinalPlacement(exam,[exam],stages,'2026年12月'),-1);
  assert.equal(schoolFinalPlacement(exam,[exam,exam],stages,'2027年5月'),-1);
  assert.equal(schoolFinalPlacement(exam,[exam],stages.slice(1),'2027年5月'),-1);
});
