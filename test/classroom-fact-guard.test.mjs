import test from 'node:test';
import assert from 'node:assert/strict';
import { applyClassroomFactGuard, hasDirectClassroomEvidence } from '../lib/reports/classroom-fact-guard.ts';

const generatedSummary = {
  classroomStatus: '提示后完成了链式法则题目',
  strength: '提示后能够调整思路',
  lessonTitle: '链式法则课堂练习',
  lessonSummary: '本节练习了复合函数求导',
  performance: '漏写内层导数后完成订正',
  outcomes: ['修正了链式法则错误'],
};

test('general learning needs do not count as direct classroom evidence', () => {
  const notes = '学生目前主要问题是基础概念不够扎实、题型应用不熟练，英文题干理解速度偏慢。';
  assert.equal(hasDirectClassroomEvidence(notes), false);
  const guarded = applyClassroomFactGuard(generatedSummary, 'AP Calculus BC', notes);
  assert.doesNotMatch(JSON.stringify(guarded), /提示后|漏写内层导数|完成订正/);
  assert.match(guarded.performance, /后续将结合具体题目观察/);
});

test('explicit classroom actions preserve evidence-based generated summary', () => {
  const notes = '课堂上学生独立完成两道链式法则题，第三题漏写内层导数，提示后完成订正。';
  assert.equal(hasDirectClassroomEvidence(notes), true);
  assert.equal(applyClassroomFactGuard(generatedSummary, 'AP Calculus BC', notes), generatedSummary);
});
