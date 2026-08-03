/** 系统支持的科目编码。 */
export type SubjectCode =
  | 'sat_math'
  | 'sat_english'
  | 'ap_calculus_ab'
  | 'ap_calculus_bc'
  | 'ap_csa'
  | 'ap_microeconomics'
  | 'ap_macroeconomics'
  | 'ap_precalculus'
  | 'ap_physics_1'
  | 'ap_physics_2'
  | 'ap_physics_c_mechanics'
  | 'ap_physics_c_electricity_magnetism'
  | 'ap_chemistry'
  | 'ap_biology'
  | 'ap_statistics'
  | 'ap_csp'
  | 'ap_us_history'
  | 'ap_world_history'
  | 'ap_european_history'
  | 'ap_psychology'
  | 'ap_human_geography'
  | 'ap_comparative_government'
  | 'ap_english_literature'
  | 'ap_english_language'
  | 'ap_art_history'
  | 'ap_environmental_science'
  | 'ap_us_government'
  | 'ap_chinese'
  | 'ap_seminar'
  | 'ap_latin'
  | 'ap_music_theory';

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
