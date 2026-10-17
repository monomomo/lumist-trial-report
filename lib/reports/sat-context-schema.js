import { z } from 'zod';

export const satEnglishAssessmentSchema = z.object({
  testType: z.enum(['toefl_ibt', 'ielts_academic']),
  scoreScale: z.enum(['new_1_6', 'legacy_0_120', 'ielts_0_9']),
  overallScore: z.number(),
  readingScore: z.number().optional(),
  testDate: z.string().regex(/^\d{4}-\d{2}$/).optional(),
}).strict().superRefine((value, context) => {
  const halfStep = (score) => Math.abs(score * 2 - Math.round(score * 2)) < 0.001;
  if (value.testType === 'toefl_ibt' && value.scoreScale === 'new_1_6') {
    if (value.overallScore < 1 || value.overallScore > 6 || !halfStep(value.overallScore)) context.addIssue({ code: 'custom', path: ['overallScore'], message: 'TOEFL 新制总分应为 1–6，支持 0.5 分档' });
    if (value.readingScore !== undefined && (value.readingScore < 1 || value.readingScore > 6 || !halfStep(value.readingScore))) context.addIssue({ code: 'custom', path: ['readingScore'], message: 'TOEFL 新制阅读应为 1–6，支持 0.5 分档' });
    return;
  }
  if (value.testType === 'toefl_ibt' && value.scoreScale === 'legacy_0_120') {
    if (!Number.isInteger(value.overallScore) || value.overallScore < 0 || value.overallScore > 120) context.addIssue({ code: 'custom', path: ['overallScore'], message: 'TOEFL 旧制总分应为 0–120 的整数' });
    if (value.readingScore !== undefined && (!Number.isInteger(value.readingScore) || value.readingScore < 0 || value.readingScore > 30)) context.addIssue({ code: 'custom', path: ['readingScore'], message: 'TOEFL 旧制阅读应为 0–30 的整数' });
    return;
  }
  if (value.testType === 'ielts_academic' && value.scoreScale === 'ielts_0_9') {
    if (value.overallScore < 0 || value.overallScore > 9 || !halfStep(value.overallScore)) context.addIssue({ code: 'custom', path: ['overallScore'], message: 'IELTS 总分应为 0–9，支持 0.5 分档' });
    if (value.readingScore !== undefined && (value.readingScore < 0 || value.readingScore > 9 || !halfStep(value.readingScore))) context.addIssue({ code: 'custom', path: ['readingScore'], message: 'IELTS 阅读应为 0–9，支持 0.5 分档' });
    return;
  }
  context.addIssue({ code: 'custom', path: ['scoreScale'], message: '语言考试与成绩分制不匹配' });
});

export const satMathHoursSchema = z.object({
  algebra: z.number().min(0).max(60).multipleOf(0.5),
  advanced_math: z.number().min(0).max(60).multipleOf(0.5),
  problem_solving_data_analysis: z.number().min(0).max(60).multipleOf(0.5),
  geometry_trigonometry: z.number().min(0).max(60).multipleOf(0.5),
  integrated_practice: z.number().min(0).max(60).multipleOf(0.5),
}).strict();

export const satSubjectContextShape = {
  satEnglishAssessment: satEnglishAssessmentSchema.optional(),
  satMathHours: satMathHoursSchema.optional(),
};

export function validateSatSubjectContext(value, context) {
  if (value.subjectCode === 'sat_english' && value.satMathHours) context.addIssue({ code: 'custom', path: ['satMathHours'], message: 'SAT 英语不能提交数学课时分配' });
  if (value.subjectCode === 'sat_math') {
    if (!value.satMathHours) {
      context.addIssue({ code: 'custom', path: ['satMathHours'], message: '请填写 SAT 数学五项课时分配' });
      return;
    }
    const assigned = Object.values(value.satMathHours).reduce((total, hours) => total + hours, 0);
    if (Math.abs(assigned - value.totalHours) > 0.001) context.addIssue({ code: 'custom', path: ['satMathHours'], message: `SAT 数学五项合计 ${assigned}h，与总课时 ${value.totalHours}h 不一致` });
  }
  if (value.subjectCode !== 'sat_english' && value.satEnglishAssessment) context.addIssue({ code: 'custom', path: ['satEnglishAssessment'], message: '语言成绩只适用于 SAT 英语' });
}
