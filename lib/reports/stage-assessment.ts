import { z } from 'zod';

export const stageAssessmentSchema = z.object({
  task: z.string().trim().min(1).max(120),
  target: z.string().trim().min(1).max(100),
  adjustment: z.string().trim().min(1).max(120),
}).strict();
