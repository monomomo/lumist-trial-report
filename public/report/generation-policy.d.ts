export function normalizeGenerationInput(input: Record<string, any>): Record<string, any>;
export function sameCoursePlan(first: unknown, second: unknown): boolean;
export function getGenerationAction(previous: Record<string, any> | null | undefined, next: Record<string, any>, options?: { forceNewPlan?: boolean }): 'reuse' | 'summary-only' | 'new-plan';
