import { z } from 'zod';

export const stageAssessmentSchema = z.object({
  objective: z.string().trim().max(100).optional(),
  examValue: z.string().trim().max(100).optional(),
  task: z.string().trim().min(1).max(120),
  target: z.string().trim().min(1).max(100),
  adjustment: z.string().trim().min(1).max(120),
}).strict();

export const generatedStageAssessmentSchema = stageAssessmentSchema.extend({objective:z.string().trim().min(1).max(100),examValue:z.string().trim().min(1).max(100).regex(/^(?![\s\S]*(?:[0-9０-９]\s*(?:%|％|道题|题|分)|(?:等同|相当于).{0,8}[五5]分))[\s\S]+$/)});
