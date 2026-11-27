import { z } from 'zod';

export const stageAssessmentSchema = z.object({
  objective: z.string().trim().max(100).optional(),
  examValue: z.string().trim().max(100).optional(),
  currentMasteryPercent: z.number().int().min(0).max(100).optional(),
  currentMasteryEvidence: z.string().trim().min(1).max(100).optional(),
  targetMasteryPercent: z.number().int().min(50).max(100).optional(),
  examWeight: z.string().trim().max(160).optional(),
  task: z.string().trim().min(1).max(120),
  target: z.string().trim().min(1).max(100),
  adjustment: z.string().trim().min(1).max(120),
}).strict().superRefine((assessment, context) => {
  if (assessment.currentMasteryPercent !== undefined && !assessment.currentMasteryEvidence) context.addIssue({code:'custom',path:['currentMasteryEvidence'],message:'当前掌握度必须附带试听课测评依据'});
  if (assessment.currentMasteryEvidence && assessment.currentMasteryPercent === undefined) context.addIssue({code:'custom',path:['currentMasteryPercent'],message:'掌握度依据必须对应明确百分比'});
});

export const generatedStageAssessmentSchema = stageAssessmentSchema.safeExtend({
  objective:z.string().trim().min(1).max(100),
  examValue:z.string().trim().min(1).max(100).regex(/^(?![\s\S]*(?:(?:等同|相当于).{0,8}[五5]分))[\s\S]+$/),
  targetMasteryPercent:z.number().int().min(50).max(100),
});
