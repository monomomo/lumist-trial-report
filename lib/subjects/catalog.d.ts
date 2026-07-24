/** 系统支持的科目编码。 */
export type SubjectCode =
  | 'sat_math'
  | 'sat_english'
  | 'ap_calculus_ab'
  | 'ap_calculus_bc'
  | 'ap_csa'
  | 'ap_microeconomics'
  | 'ap_macroeconomics';

/** 科目成绩口径、课程模块及提示词事实边界。 */
export interface SubjectDefinition {
  readonly code: SubjectCode;
  readonly displayName: string;
  readonly scoreLabel: string;
  readonly scoreMin: number;
  readonly scoreMax: number;
  readonly scoreStep: number;
  readonly modules: readonly string[];
  readonly promptContext: string;
}

/** 成绩校验错误。 */
export interface ScoreValidationError {
  readonly path: 'currentScore' | 'targetScore';
  readonly message: string;
}

/** 成绩校验结果。 */
export interface ScoreValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ScoreValidationError[];
}

export const SUBJECT_CODES: readonly SubjectCode[];
export const SUBJECT_CATALOG: Readonly<Record<SubjectCode, SubjectDefinition>>;

/** 未传编码时返回 SAT 数学，非法编码抛出 RangeError。 */
export function resolveSubject(code?: string | null): SubjectDefinition;

/** 空成绩允许，其余成绩按科目区间、步长及目标不低于当前规则校验。 */
export function validateSubjectScores(
  code: string | null | undefined,
  currentScore?: string | number | null,
  targetScore?: string | number | null
): ScoreValidationResult;
