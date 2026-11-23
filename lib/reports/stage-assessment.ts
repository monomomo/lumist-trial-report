import { z } from 'zod';

export const stageAssessmentSchema = z.object({
  objective: z.string().trim().max(100).optional(),
  task: z.string().trim().min(1).max(120),
  target: z.string().trim().min(1).max(100),
  adjustment: z.string().trim().min(1).max(120),
}).strict();

export const generatedStageAssessmentSchema = stageAssessmentSchema.extend({objective:z.string().trim().min(1).max(100)});
