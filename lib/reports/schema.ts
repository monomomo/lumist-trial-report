import { z } from 'zod';
import { SUBJECT_CODES, SUBJECT_CATALOG, validateSubjectScores } from '../subjects/catalog.js';
import { PLANNING_SCENARIO_CODES } from './planning-context.js';

const subjectNames = SUBJECT_CODES.map((code) => SUBJECT_CATALOG[code].displayName) as [string, ...string[]];
const subjectSchema = z.enum(subjectNames);

const lessonSchema = z.object({
  duration: z.union([z.literal(0.5), z.literal(1), z.literal(1.5), z.literal(2)]),
  theme: z.string().trim().min(1).max(60),
  content: z.string().trim().min(1).max(300),
  difficulty: z.string().trim().min(1).max(180),
  goal: z.string().trim().min(1).max(180),
}).strict();

const coursePlanSchema = z.object({
  totalHours: z.number().min(2).max(60).multipleOf(0.5),
  rationale: z.string().trim().min(1).max(180),
  stages: z.array(z.object({
    title: z.string().trim().min(1).max(50),
    description: z.string().trim().max(160),
    lessons: z.array(lessonSchema).min(1).max(30),
  }).strict()).min(1).max(12),
}).strict().superRefine((plan, context) => {
  const plannedHours = plan.stages.reduce(
    (total, stage) => total + stage.lessons.reduce((stageTotal, lesson) => stageTotal + lesson.duration, 0),
    0,
  );
  if (Math.abs(plannedHours - plan.totalHours) > 0.001) {
    context.addIssue({
      code: 'custom',
      path: ['totalHours'],
      message: `课程规划课时合计为 ${plannedHours}h，与总课时 ${plan.totalHours}h 不一致`,
    });
  }
});

const reportDataSchema = z.object({
  overview: z.string().trim().min(1).max(500),
  classroomStatus: z.string().trim().min(1).max(160),
  strength: z.string().trim().min(1).max(160),
  currentFocus: z.string().trim().min(1).max(180),
  lessonTitle: z.string().trim().min(1).max(80),
  lessonSummary: z.string().trim().min(1).max(400),
  performance: z.string().trim().min(1).max(300),
  outcomes: z.array(z.string().trim().min(1).max(120)).min(1).max(5),
  priorityAreas: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
  planningContext: z.object({
    scenario: z.enum(PLANNING_SCENARIO_CODES as [string, ...string[]]),
    lessonCount: z.number().int().min(1).max(60),
  }).strict().optional(),
  teacherNotice: z.string().trim().max(500).optional(),
  qualityReview: z.object({
    reviewCompleted: z.boolean(),
    subjectScopePassed: z.boolean(),
    teacherVoicePassed: z.boolean(),
    modelWarnings: z.array(z.string().trim().min(1).max(300)).max(20),
  }).strict().optional(),
  target: z.string().trim().max(50).optional(),
}).strict();

const salesFollowUpSchema = z.object({
  positive: z.string().trim().min(1).max(240),
  urgent: z.string().trim().min(1).max(320),
  angle: z.string().trim().min(1).max(260),
  script: z.string().trim().min(1).max(800),
}).strict();

const reportSaveShape = {
  studentName: z.string().trim().min(1).max(30),
  subject: subjectSchema,
  currentScore: z.string().trim().max(30),
  targetScore: z.string().trim().max(30),
  examDate: z.string().trim().max(50),
  teacherNotes: z.string().trim().min(20).max(6000),
  reportData: reportDataSchema,
  coursePlan: coursePlanSchema,
  salesFollowUp: salesFollowUpSchema,
};

type ReportValidationInput = {
  subject: string;
  currentScore: string;
  targetScore: string;
  reportData: { planningContext?: { lessonCount: number } };
  coursePlan: { stages: Array<{ lessons: unknown[] }> };
};

function validateReport(data: ReportValidationInput, context: z.RefinementCtx) {
  const subjectCode = SUBJECT_CODES.find((code) => SUBJECT_CATALOG[code].displayName === data.subject);
  if (subjectCode) {
    const targetScore = data.targetScore || (subjectCode.startsWith('ap_') ? '5' : '');
    const validation = validateSubjectScores(subjectCode, data.currentScore, targetScore);
    validation.errors.forEach((error) => context.addIssue({
      code: 'custom',
      path: [error.path],
      message: error.message,
    }));
  }
  const savedLessonCount = data.reportData?.planningContext?.lessonCount;
  if (savedLessonCount !== undefined) {
    const actualLessonCount = data.coursePlan.stages.reduce((total, stage) => total + stage.lessons.length, 0);
    if (savedLessonCount !== actualLessonCount) {
      context.addIssue({
        code: 'custom',
        path: ['reportData', 'planningContext', 'lessonCount'],
        message: `预计课次 ${savedLessonCount} 与课程规划 ${actualLessonCount} 节不一致`,
      });
    }
  }
}

export const reportCreateSchema = z.object({
  ...reportSaveShape,
  id: z.null().optional(),
}).strict().superRefine(validateReport);

export const reportUpdateSchema = z.object({
  ...reportSaveShape,
  id: z.string().uuid(),
}).strict().superRefine(validateReport);

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;
