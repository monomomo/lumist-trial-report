export { buildLessonDurationSlots } from '../reports/planning-context.js';

export function applyLessonDurationSlots<
  T extends { lessons: Array<Record<string, unknown>> }
>(stages: T[], durations: number[]) {
  const lessonCount = stages.reduce((sum, stage) => sum + stage.lessons.length, 0);
  if (lessonCount !== durations.length) {
    throw new RangeError('COURSE_PLAN_LESSON_COUNT_MISMATCH');
  }
  let slotIndex = 0;
  return stages.map((stage) => ({
    ...stage,
    lessons: stage.lessons.map((lesson) => ({
      ...lesson,
      duration: durations[slotIndex++],
    })),
  }));
}
