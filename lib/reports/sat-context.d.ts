export type SatMathAreaCode = 'algebra' | 'advanced_math' | 'problem_solving_data_analysis' | 'geometry_trigonometry' | 'integrated_practice';
export type SatMathHours = Record<SatMathAreaCode, number>;
export type SatMathLessonAllocation = Array<{ code: SatMathAreaCode; hours: number }>;
export type SatEnglishAssessment = {
  testType: 'toefl_ibt' | 'ielts_academic';
  scoreScale: 'new_1_6' | 'legacy_0_120' | 'ielts_0_9';
  overallScore: number;
  readingScore?: number;
  testDate?: string;
};
export const SAT_MATH_AREA_CONFIG: ReadonlyArray<{ code: SatMathAreaCode; label: string; description: string }>;
export const SAT_MATH_AREA_CODES: SatMathAreaCode[];
export function createEmptySatMathHours(): Record<SatMathAreaCode, string>;
export function normalizeSatMathHours(value: unknown): SatMathHours;
export function sumSatMathHours(value: unknown): number;
export function validateSatMathHours(value: unknown, totalHours: unknown): { valid: boolean; code?: string; message?: string; hours?: SatMathHours; assigned?: number };
export function suggestSatMathHours(totalHours: unknown): SatMathHours | null;
export function buildSatMathLessonAllocations(value: unknown, lessonDurations: number[]): SatMathLessonAllocation[];
export function validateSatEnglishAssessment(value: unknown): { valid: boolean; field?: string; message?: string; assessment?: SatEnglishAssessment | null };
