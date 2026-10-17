import { z } from 'zod';
import { satSubjectContextShape } from './sat-context-validation.js';
export const generationSnapshotSchema: z.ZodObject<{
  source: z.ZodEnum<{ ai: 'ai'; upload: 'upload' }>;
  subjectCode: z.ZodString;
  studentName: z.ZodString;
  currentScore: z.ZodString;
  targetScore: z.ZodString;
  examDate: z.ZodString;
  totalHours: z.ZodNumber;
  lessonCount: z.ZodNumber;
  planningScenario: z.ZodString;
  planningFocusAreas: z.ZodArray<z.ZodString>;
  includeExamTraining: z.ZodBoolean;
  teacherNotes: z.ZodString;
} & typeof satSubjectContextShape>;
