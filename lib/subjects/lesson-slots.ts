export { buildLessonDurationSlots } from '../reports/planning-context.js';

type CoursePlanLesson = {
  theme: string;
  content: string;
  difficulty: string;
  goal: string;
  unitCodes: string[];
};

type CoursePlanStage = {
  title: string;
  description: string;
  lessons: CoursePlanLesson[];
};

function mergeLessonText(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].join('；');
}

export function reconcileCoursePlanLessonCount<T extends CoursePlanStage>(stages: T[], expectedCount: number) {
  const normalizedStages = stages.map((stage) => ({
    ...stage,
    lessons: stage.lessons.map((lesson) => ({
      ...lesson,
      unitCodes: [...lesson.unitCodes],
    })),
  }));
  const actualCount = normalizedStages.reduce((total, stage) => total + stage.lessons.length, 0);

  if (actualCount === expectedCount) {
    return { stages: normalizedStages, warning: '' };
  }

  if (actualCount < expectedCount) {
    const missingCount = expectedCount - actualCount;
    if (normalizedStages.length === 0) {
      throw new RangeError('COURSE_PLAN_STAGE_MISSING');
    }
    for (let index = 0; index < missingCount; index += 1) {
      const targetStage = [...normalizedStages].reverse().find((stage) => stage.lessons.length < 12);
      if (!targetStage) {
        throw new RangeError('COURSE_PLAN_STAGE_CAPACITY_EXCEEDED');
      }
      targetStage.lessons.push({
        theme: `待老师补充：第 ${actualCount + index + 1} 节课`,
        content: 'AI 未生成本课内容，请结合前后课程与学生实际情况补充具体教学任务。',
        difficulty: '请根据学生实际掌握情况补充本课需要关注的重点与难点。',
        goal: '请补充本课可观察、可核对的学习目标。',
        unitCodes: [],
      });
    }
    return {
      stages: normalizedStages,
      warning: `课程规划应有 ${expectedCount} 节课，AI 实际生成 ${actualCount} 节；系统已补入 ${missingCount} 节“待老师补充”课时。请在交付家长前完善这些课时的主题、内容、重难点和目标。`,
    };
  }

  const extraCount = actualCount - expectedCount;
  const removedLessons: CoursePlanLesson[] = [];
  while (normalizedStages.reduce((total, stage) => total + stage.lessons.length, 0) > expectedCount) {
    const finalStage = normalizedStages.at(-1);
    const removedLesson = finalStage?.lessons.pop();
    if (removedLesson) {
      removedLessons.unshift(removedLesson);
    }
    if (finalStage && finalStage.lessons.length === 0) {
      normalizedStages.pop();
    }
  }
  const finalLesson = normalizedStages.at(-1)?.lessons.at(-1);
  if (!finalLesson) {
    throw new RangeError('COURSE_PLAN_LESSON_MISSING');
  }
  const mergedLessons = [finalLesson, ...removedLessons];
  finalLesson.theme = mergeLessonText(mergedLessons.map((lesson) => lesson.theme));
  finalLesson.content = mergeLessonText(mergedLessons.map((lesson) => lesson.content));
  finalLesson.difficulty = mergeLessonText(mergedLessons.map((lesson) => lesson.difficulty));
  finalLesson.goal = mergeLessonText(mergedLessons.map((lesson) => lesson.goal));
  finalLesson.unitCodes = [...new Set(mergedLessons.flatMap((lesson) => lesson.unitCodes))];

  return {
    stages: normalizedStages,
    warning: `课程规划应有 ${expectedCount} 节课，AI 实际生成 ${actualCount} 节；系统已将多出的 ${extraCount} 节内容合并到最后一节保留课时。请在交付家长前核对最后一节的内容与安排。`,
  };
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
