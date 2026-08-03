import { z } from 'zod';
import { SUBJECT_CODES, SUBJECT_CATALOG } from '../subjects/catalog.js';

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
  teacherNotice: z.string().trim().max(500).optional(),
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

export const reportCreateSchema = z.object({
  ...reportSaveShape,
  id: z.null().optional(),
}).strict();

export const reportUpdateSchema = z.object({
  ...reportSaveShape,
  id: z.string().uuid(),
}).strict();

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;
