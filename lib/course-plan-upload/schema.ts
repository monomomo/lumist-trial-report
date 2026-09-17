import { z } from 'zod';

export const uploadedLessonSchema = z.object({
  sourceNumber: z.string().trim().max(30).nullable(),
  duration: z.number().min(0.5).max(2).multipleOf(0.5).nullable(),
  theme: z.string().trim().min(1).max(120),
  content: z.string().trim().max(600),
  sourceText: z.string().trim().min(1).max(1000),
}).strict();

export const uploadedStageSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300),
  declaredLessonCount: z.number().int().min(1).max(60).nullable(),
  declaredHours: z.number().min(0.5).max(60).multipleOf(0.5).nullable(),
  lessons: z.array(uploadedLessonSchema).min(1).max(60),
}).strict();

export const uploadedPlanExtractionSchema = z.object({
  title: z.string().trim().max(160),
  declaredLessonCount: z.number().int().min(1).max(60).nullable(),
  declaredTotalHours: z.number().min(0.5).max(60).multipleOf(0.5).nullable(),
  stages: z.array(uploadedStageSchema).min(1).max(20),
  corrections: z.array(z.object({
    original: z.string().trim().min(1).max(300),
    corrected: z.string().trim().min(1).max(300),
    reason: z.enum(['typo', 'spelling', 'capitalization', 'punctuation', 'spacing']),
  }).strict()).max(100),
  ambiguities: z.array(z.object({
    message: z.string().trim().min(1).max(300),
    sourceText: z.string().trim().max(500),
  }).strict()).max(100),
}).strict();

export const lockedLessonSchema = z.object({
  duration: z.union([z.literal(0.5), z.literal(1), z.literal(1.5), z.literal(2)]),
  theme: z.string().trim().min(1).max(120),
  content: z.string().trim().max(600),
  difficulty: z.string().trim().max(180).default(''),
  goal: z.string().trim().max(180).default(''),
  unitCodes: z.array(z.string().trim().min(1).max(20)).max(10).default([]),
}).strict();

export const lockedCoursePlanSchema = z.object({
  totalHours: z.number().min(2).max(60).multipleOf(0.5),
  rationale: z.string().trim().max(180).default(''),
  stages: z.array(z.object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(300),
    lessons: z.array(lockedLessonSchema).min(1).max(60),
  }).strict()).min(1).max(20),
}).strict().superRefine((plan, context) => {
  const lessons = plan.stages.flatMap((stage) => stage.lessons);
  const plannedHours = lessons.reduce((total, lesson) => total + lesson.duration, 0);
  if (lessons.length > 60) {
    context.addIssue({ code: 'custom', path: ['stages'], message: '课程规划最多支持 60 节课' });
  }
  if (Math.abs(plannedHours - plan.totalHours) > 0.001) {
    context.addIssue({ code: 'custom', path: ['totalHours'], message: `逐节合计为 ${plannedHours}h，与总课时 ${plan.totalHours}h 不一致` });
  }
});

export type UploadedPlanExtraction = z.infer<typeof uploadedPlanExtractionSchema>;
export type LockedCoursePlan = z.infer<typeof lockedCoursePlanSchema>;

export function buildLockedPlan(extraction: UploadedPlanExtraction) {
  const missingDurations = extraction.stages.flatMap((stage) => stage.lessons).filter((lesson) => lesson.duration === null);
  if (missingDurations.length) throw new RangeError('UPLOADED_PLAN_DURATION_MISSING');
  const stages = extraction.stages.map((stage) => ({
    title: stage.title,
    description: stage.description,
    lessons: stage.lessons.map((lesson) => ({
      duration: lesson.duration as 0.5 | 1 | 1.5 | 2,
      theme: lesson.theme,
      content: lesson.content,
      difficulty: '',
      goal: '',
      unitCodes: [],
    })),
  }));
  const totalHours = stages.flatMap((stage) => stage.lessons).reduce((total, lesson) => total + lesson.duration, 0);
  return lockedCoursePlanSchema.parse({ totalHours, rationale: '', stages });
}

export function getUploadedPlanWarnings(extraction: UploadedPlanExtraction) {
  const lessons = extraction.stages.flatMap((stage) => stage.lessons);
  const actualHours = lessons.reduce((total, lesson) => total + (lesson.duration ?? 0), 0);
  const warnings = extraction.ambiguities.map((item) => item.message);
  if (lessons.some((lesson) => lesson.duration === null)) warnings.push('部分课次没有明确时长，请老师补充后再确认');
  if (extraction.declaredLessonCount !== null && extraction.declaredLessonCount !== lessons.length) {
    warnings.push(`文件声明 ${extraction.declaredLessonCount} 节，实际解析为 ${lessons.length} 节`);
  }
  if (extraction.declaredTotalHours !== null && Math.abs(extraction.declaredTotalHours - actualHours) > 0.001) {
    warnings.push(`文件声明 ${extraction.declaredTotalHours}h，逐节合计为 ${actualHours}h`);
  }
  extraction.stages.forEach((stage) => {
    const stageHours = stage.lessons.reduce((total, lesson) => total + (lesson.duration ?? 0), 0);
    if (stage.declaredLessonCount !== null && stage.declaredLessonCount !== stage.lessons.length) {
      warnings.push(`${stage.title} 声明 ${stage.declaredLessonCount} 节，实际解析为 ${stage.lessons.length} 节`);
    }
    if (stage.declaredHours !== null && Math.abs(stage.declaredHours - stageHours) > 0.001) {
      warnings.push(`${stage.title} 声明 ${stage.declaredHours}h，逐节合计为 ${stageHours}h`);
    }
  });
  return [...new Set(warnings)];
}
