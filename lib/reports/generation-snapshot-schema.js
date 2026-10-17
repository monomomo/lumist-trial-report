import { z } from 'zod';
import { SUBJECT_CODES } from '../subjects/catalog.js';
import { PLANNING_FOCUS_AREA_CODES, PLANNING_SCENARIO_CODES } from './planning-context.js';
import { satSubjectContextShape } from './sat-context-validation.js';

export const generationSnapshotSchema = z.object({
  source: z.enum(['ai', 'upload']),
  subjectCode: z.enum(SUBJECT_CODES),
  studentName: z.string().trim().min(1).max(30),
  currentScore: z.string().trim().max(30),
  targetScore: z.string().trim().max(30),
  examDate: z.string().trim().max(50),
  totalHours: z.number().min(2).max(60).multipleOf(0.5),
  lessonCount: z.number().int().min(1).max(60),
  planningScenario: z.enum(PLANNING_SCENARIO_CODES),
  planningFocusAreas: z.array(z.enum(PLANNING_FOCUS_AREA_CODES)).max(3),
  includeExamTraining: z.boolean(),
  teacherNotes: z.string().trim().min(20).max(6000),
  ...satSubjectContextShape,
}).strict();
