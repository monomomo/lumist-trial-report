import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUnnaturalTeacherPerspective, normalizeTeacherPerspective } from '../lib/reports/teacher-perspective.ts';

test('teacher perspective normalization preserves natural first-person sentences', () => {
  assert.equal(normalizeTeacherPerspective('我是本节试听课的老师。'), '本次试听课由我授课。');
  assert.equal(normalizeTeacherPerspective('根据老师记录，学生完成了练习。'), '根据本次课堂情况，学生完成了练习。');
  assert.equal(hasUnnaturalTeacherPerspective('我是本节试听课的我。'), true);
  assert.equal(hasUnnaturalTeacherPerspective(normalizeTeacherPerspective('我是本节试听课的老师。')), false);
});
