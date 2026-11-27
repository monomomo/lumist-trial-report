import { z } from 'zod';

const stageAssessmentShape = {
  objective: z.string().trim().max(100).optional(),
  examValue: z.string().trim().max(100).optional(),
  currentMasteryPercent: z.number().int().min(0).max(100).optional(),
  currentMasteryEvidence: z.string().trim().min(1).max(100).optional(),
  targetMasteryPercent: z.number().int().min(50).max(100).optional(),
  examWeight: z.string().trim().max(160).optional(),
  task: z.string().trim().min(1).max(120),
  target: z.string().trim().min(1).max(100),
  adjustment: z.string().trim().min(1).max(120),
};

function validateMasteryEvidence(assessment: {currentMasteryPercent?: number | null; currentMasteryEvidence?: string | null}, context: z.RefinementCtx) {
  const hasPercent = typeof assessment.currentMasteryPercent === 'number';
  const hasEvidence = typeof assessment.currentMasteryEvidence === 'string' && assessment.currentMasteryEvidence.length > 0;
  if (hasPercent && !hasEvidence) context.addIssue({code:'custom',path:['currentMasteryEvidence'],message:'当前掌握度必须附带试听课测评依据'});
  if (hasEvidence && !hasPercent) context.addIssue({code:'custom',path:['currentMasteryPercent'],message:'掌握度依据必须对应明确百分比'});
}

export const stageAssessmentSchema = z.object(stageAssessmentShape).strict().superRefine(validateMasteryEvidence);

export const generatedStageAssessmentSchema = z.object({
  ...stageAssessmentShape,
  objective:z.string().trim().min(1).max(100),
  examValue:z.string().trim().min(1).max(100).regex(/^(?![\s\S]*(?:(?:等同|相当于).{0,8}[五5]分))[\s\S]+$/),
  currentMasteryPercent:z.number().int().min(0).max(100).nullable(),
  currentMasteryEvidence:z.string().trim().min(1).max(100).nullable(),
  targetMasteryPercent:z.number().int().min(50).max(100),
  examWeight:z.string().trim().max(160).nullable(),
}).strict().superRefine(validateMasteryEvidence);

export function normalizeGeneratedStageAssessment(assessment: z.infer<typeof generatedStageAssessmentSchema>): z.infer<typeof stageAssessmentSchema> {
  return {
    objective:assessment.objective,
    examValue:assessment.examValue,
    currentMasteryPercent:assessment.currentMasteryPercent ?? undefined,
    currentMasteryEvidence:assessment.currentMasteryEvidence ?? undefined,
    targetMasteryPercent:assessment.targetMasteryPercent,
    examWeight:assessment.examWeight ?? undefined,
    task:assessment.task,
    target:assessment.target,
    adjustment:assessment.adjustment,
  };
}
