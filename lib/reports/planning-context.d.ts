export type PlanningScenarioCode = 'preview' | 'synchronous' | 'intensive';

export const PLANNING_SCENARIOS: Record<PlanningScenarioCode, {
  label: string;
  guidance: string;
  sample: string;
}>;

export const PLANNING_SCENARIO_CODES: PlanningScenarioCode[];
export const DEFAULT_PLANNING_SCENARIO: PlanningScenarioCode;

export function resolvePlanningScenario(value: unknown): PlanningScenarioCode;
export function buildLessonDurationSlots(totalHours: number, requestedLessonCount?: number | string | null): number[];
export function getLessonCountRange(totalHours: number | string): {
  minimum: number;
  maximum: number;
} | null;
