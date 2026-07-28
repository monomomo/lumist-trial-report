export function buildLessonDurationSlots(totalHours: number) {
  const totalUnits = totalHours * 2;
  if (!Number.isInteger(totalUnits) || totalHours < 0.5) {
    throw new RangeError('INVALID_TOTAL_HOURS');
  }
  const lessonCount = Math.ceil(totalHours / 2);
  const baseUnits = Math.floor(totalUnits / lessonCount);
  let remainder = totalUnits - baseUnits * lessonCount;
  return Array.from({ length: lessonCount }, () => {
    const units = baseUnits + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return units / 2;
  });
}

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
