import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLessonDurationSlots,
  buildLessonDurationSlots,
} from '../lib/subjects/lesson-slots.ts';

test('lesson slots cover short and long plans with exact supported durations', () => {
  for (const totalHours of [2, 2.5, 8, 20, 50, 60]) {
    const slots = buildLessonDurationSlots(totalHours);
    assert.equal(slots.reduce((sum, duration) => sum + duration, 0), totalHours);
    assert.equal(slots.length, Math.ceil(totalHours / 2));
    assert.equal(slots.every((duration) => [0.5, 1, 1.5, 2].includes(duration)), true);
  }
  assert.deepEqual(buildLessonDurationSlots(2), [2]);
  assert.deepEqual(buildLessonDurationSlots(2.5), [1.5, 1]);
  assert.deepEqual(buildLessonDurationSlots(50), Array(25).fill(2));
});

test('lesson slots attach across stage boundaries without changing content', () => {
  const stages = [
    { title: '阶段一', lessons: [{ theme: 'A' }, { theme: 'B' }] },
    { title: '阶段二', lessons: [{ theme: 'C' }] },
  ];
  const result = applyLessonDurationSlots(stages, [1.5, 1, 2]);
  assert.deepEqual(result.flatMap((stage) => stage.lessons.map((lesson) => lesson.duration)), [1.5, 1, 2]);
  assert.deepEqual(result.flatMap((stage) => stage.lessons.map((lesson) => lesson.theme)), ['A', 'B', 'C']);
  assert.equal('duration' in stages[0].lessons[0], false);
  assert.throws(() => applyLessonDurationSlots(stages, [1, 1]), /COURSE_PLAN_LESSON_COUNT_MISMATCH/);
});

test('lesson slots honor an editable lesson count without changing total hours', () => {
  assert.deepEqual(buildLessonDurationSlots(30, 20), Array(20).fill(1.5));
  assert.deepEqual(buildLessonDurationSlots(5, 4), [1.5, 1.5, 1, 1]);
  assert.throws(() => buildLessonDurationSlots(30, 10), /INVALID_LESSON_COUNT_FOR_TOTAL_HOURS/);
  assert.throws(() => buildLessonDurationSlots(30, 61), /INVALID_LESSON_COUNT/);
});
