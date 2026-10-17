import { z } from 'zod';
export const satEnglishAssessmentSchema: z.ZodType<{
  testType: 'toefl_ibt' | 'ielts_academic';
  scoreScale: 'new_1_6' | 'legacy_0_120' | 'ielts_0_9';
  overallScore: number;
  readingScore?: number;
  testDate?: string;
}>;
export const satMathHoursSchema: z.ZodType<{
  algebra: number;
  advanced_math: number;
  problem_solving_data_analysis: number;
  geometry_trigonometry: number;
  integrated_practice: number;
}>;
export const satSubjectContextShape: {
  satEnglishAssessment: z.ZodOptional<typeof satEnglishAssessmentSchema>;
  satMathHours: z.ZodOptional<typeof satMathHoursSchema>;
};
export function validateSatSubjectContext(value: {
  subjectCode: string;
  totalHours: number;
  satEnglishAssessment?: z.infer<typeof satEnglishAssessmentSchema>;
  satMathHours?: z.infer<typeof satMathHoursSchema>;
}, context: z.RefinementCtx): void;
