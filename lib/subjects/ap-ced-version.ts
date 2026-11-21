import type { SubjectCode } from './catalog.js';

const effectiveFall = {
  ap_calculus_ab:2020, ap_calculus_bc:2020, ap_art_history:2020, ap_human_geography:2020,
  ap_csp:2023, ap_chemistry:2024, ap_physics_1:2024, ap_physics_2:2024,
  ap_physics_c_mechanics:2024, ap_physics_c_electricity_magnetism:2024,
  ap_seminar:2024, ap_english_language:2024, ap_english_literature:2024,
  ap_csa:2025, ap_biology:2025, ap_psychology:2025, ap_latin:2025,
  ap_precalculus:2026, ap_statistics:2026, ap_chinese:2026, ap_music_theory:2026,
  ap_us_history:2026, ap_world_history:2026, ap_european_history:2026, ap_environmental_science:2026,
  ap_microeconomics:2026, ap_macroeconomics:2026, ap_micro_macro_economics:2026,
  ap_us_government:2026, ap_comparative_government:2026, ap_business_personal_finance:2026,
} satisfies Record<Extract<SubjectCode, `ap_${string}`>,number>;

export function apCedVersion(code: string) {
  if (!Object.hasOwn(effectiveFall,code)) throw new Error('未登记该科目在 2026–27 学年的适用考纲');
  return {
    effectiveFall:effectiveFall[code as keyof typeof effectiveFall],
    versionIndex:'https://apcentral.collegeboard.org/courses/how-ap-develops-courses-and-exams/course-changes-overview',
    instruction:'使用 2026–27 学年适用的 CED 及当年考试修订，不采用后续学年预告版。不确定的题量、权重和考试规则不要自行补写。',
  };
}
