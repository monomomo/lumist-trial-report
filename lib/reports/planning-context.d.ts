export type PlanningScenarioCode = 'preview' | 'synchronous' | 'intensive';

export const PLANNING_SCENARIOS: Record<PlanningScenarioCode, {
  label: string;
  guidance: string;
  sample: string;
}>;

export const PLANNING_SCENARIO_CODES: PlanningScenarioCode[];
export const DEFAULT_PLANNING_SCENARIO: PlanningScenarioCode;
export type PlanningFocusAreaCode = 'knowledge_foundation' | 'problem_solving' | 'data_analysis' | 'experimental_inquiry' | 'english_terminology' | 'study_habits';
export const PLANNING_FOCUS_AREAS: Record<PlanningFocusAreaCode, {
  label: string;
  guidance: string;
}>;
export const PLANNING_FOCUS_AREA_CODES: PlanningFocusAreaCode[];
export const MAX_PLANNING_FOCUS_AREAS: 3;

export function resolvePlanningScenario(value: unknown): PlanningScenarioCode;
export function getPlanningFocusOptions(subjectCode: string): Array<{
  code: PlanningFocusAreaCode;
  label: string;
  guidance: string;
}>;
export function normalizePlanningFocusAreas(values: unknown, subjectCode: string): PlanningFocusAreaCode[];
export function buildLessonDurationSlots(totalHours: number, requestedLessonCount?: number | string | null): number[];
export function getLessonCountRange(totalHours: number | string): {
  minimum: number;
  maximum: number;
} | null;
