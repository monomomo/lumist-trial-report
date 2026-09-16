import { SUBJECT_CATALOG, type SubjectCode } from './catalog.js';

type FrameworkType = 'units' | 'bigIdeas' | 'skillAreas';

type FrameworkMeta = {
  slug: string;
  type: FrameworkType;
  practices: string[];
};

const MATH_PRACTICES = ['Procedures and rules', 'Connecting representations', 'Justification', 'Communication and notation'];
const SCIENCE_PRACTICES = ['Concept explanation', 'Visual representations', 'Questions and methods', 'Data analysis', 'Mathematical routines', 'Argumentation'];
const HISTORY_PRACTICES = ['Developments and processes', 'Sourcing and situation', 'Claims and evidence', 'Contextualization', 'Making connections', 'Argumentation'];
const SOCIAL_SCIENCE_PRACTICES = ['Principles and models', 'Interpretation', 'Data and source analysis', 'Causal reasoning', 'Argumentation'];
const LANGUAGE_PRACTICES = ['Interpretive communication', 'Interpersonal communication', 'Presentational communication', 'Cultural comparison'];

const FRAMEWORK_META: Partial<Record<SubjectCode, FrameworkMeta>> = {
  ap_calculus_ab: { slug: 'ap-calculus-ab', type: 'units', practices: MATH_PRACTICES },
  ap_calculus_bc: { slug: 'ap-calculus-bc', type: 'units', practices: MATH_PRACTICES },
  ap_precalculus: { slug: 'ap-precalculus', type: 'units', practices: MATH_PRACTICES },
  ap_statistics: { slug: 'ap-statistics', type: 'units', practices: ['Selecting statistical methods', 'Data analysis', 'Probability and simulation', 'Statistical argumentation'] },
  ap_csa: { slug: 'ap-computer-science-a', type: 'units', practices: ['Design code', 'Develop code', 'Analyze code', 'Document code and computing systems', 'Use computers responsibly'] },
  ap_csp: { slug: 'ap-computer-science-principles', type: 'bigIdeas', practices: ['Computational solution design', 'Algorithms and program development', 'Abstraction in program development', 'Code analysis', 'Computing innovations'] },
  ap_physics_1: { slug: 'ap-physics-1', type: 'units', practices: SCIENCE_PRACTICES },
  ap_physics_2: { slug: 'ap-physics-2', type: 'units', practices: SCIENCE_PRACTICES },
  ap_physics_c_mechanics: { slug: 'ap-physics-c-mechanics', type: 'units', practices: SCIENCE_PRACTICES },
  ap_physics_c_electricity_magnetism: { slug: 'ap-physics-c-electricity-and-magnetism', type: 'units', practices: SCIENCE_PRACTICES },
  ap_chemistry: { slug: 'ap-chemistry', type: 'units', practices: SCIENCE_PRACTICES },
  ap_biology: { slug: 'ap-biology', type: 'units', practices: SCIENCE_PRACTICES },
  ap_environmental_science: { slug: 'ap-environmental-science', type: 'units', practices: SCIENCE_PRACTICES },
  ap_microeconomics: { slug: 'ap-microeconomics', type: 'units', practices: ['Principles and models', 'Interpretation', 'Manipulation', 'Graphing and visuals'] },
  ap_macroeconomics: { slug: 'ap-macroeconomics', type: 'units', practices: ['Principles and models', 'Interpretation', 'Manipulation', 'Graphing and visuals'] },
  ap_micro_macro_economics: { slug: 'ap-microeconomics', type: 'units', practices: ['Principles and models', 'Interpretation', 'Manipulation', 'Graphing and visuals'] },
  ap_business_personal_finance: { slug: 'ap-business-personal-finance', type: 'units', practices: ['Concept application', 'Entrepreneurship', 'Decision making', 'Communication', 'Collaboration'] },
  ap_us_history: { slug: 'ap-united-states-history', type: 'units', practices: HISTORY_PRACTICES },
  ap_world_history: { slug: 'ap-world-history-modern', type: 'units', practices: HISTORY_PRACTICES },
  ap_european_history: { slug: 'ap-european-history', type: 'units', practices: HISTORY_PRACTICES },
  ap_psychology: { slug: 'ap-psychology', type: 'units', practices: ['Concept application', 'Research methods and design', 'Data interpretation', 'Argumentation'] },
  ap_human_geography: { slug: 'ap-human-geography', type: 'units', practices: SOCIAL_SCIENCE_PRACTICES },
  ap_comparative_government: { slug: 'ap-comparative-government-and-politics', type: 'units', practices: SOCIAL_SCIENCE_PRACTICES },
  ap_us_government: { slug: 'ap-united-states-government-and-politics', type: 'units', practices: SOCIAL_SCIENCE_PRACTICES },
  ap_english_literature: { slug: 'ap-english-literature-and-composition', type: 'skillAreas', practices: ['Explain the function of character, setting, structure, narration, and language', 'Develop literary arguments with textual evidence'] },
  ap_english_language: { slug: 'ap-english-language-and-composition', type: 'skillAreas', practices: ['Rhetorical situation', 'Claims and evidence', 'Reasoning and organization', 'Style', 'Synthesis and argumentation'] },
  ap_art_history: { slug: 'ap-art-history', type: 'units', practices: ['Visual analysis', 'Contextual analysis', 'Comparison', 'Attribution', 'Argumentation'] },
  ap_chinese: { slug: 'ap-chinese-language-and-culture', type: 'skillAreas', practices: LANGUAGE_PRACTICES },
  ap_latin: { slug: 'ap-latin', type: 'skillAreas', practices: ['Reading and comprehension', 'Translation', 'Textual analysis', 'Contextualization', 'Argumentation'] },
  ap_music_theory: { slug: 'ap-music-theory', type: 'skillAreas', practices: ['Analyze performed music', 'Analyze notated music', 'Convert between performed and notated music', 'Complete based on cues'] },
  ap_seminar: { slug: 'ap-seminar', type: 'skillAreas', practices: ['Question and explore', 'Understand and analyze argument', 'Evaluate sources and evidence', 'Synthesize ideas', 'Team and individual presentation'] },
};

const CODE_PREFIXES: Partial<Record<SubjectCode, string>> = {
  ap_calculus_ab: 'calc', ap_calculus_bc: 'calc', ap_precalculus: 'precalc', ap_statistics: 'stats',
  ap_csa: 'csa', ap_csp: 'csp', ap_physics_1: 'phys1', ap_physics_2: 'phys2',
  ap_physics_c_mechanics: 'physcm', ap_physics_c_electricity_magnetism: 'physce', ap_chemistry: 'chem',
  ap_biology: 'bio', ap_environmental_science: 'apes', ap_microeconomics: 'micro',
  ap_macroeconomics: 'macro', ap_micro_macro_economics: 'econ', ap_us_history: 'apush',
  ap_business_personal_finance: 'bpf',
  ap_world_history: 'whap', ap_european_history: 'euro', ap_psychology: 'psych',
  ap_human_geography: 'hug', ap_comparative_government: 'compgov', ap_us_government: 'usgov',
  ap_english_literature: 'lit', ap_english_language: 'lang', ap_art_history: 'arth',
  ap_chinese: 'chn', ap_latin: 'latin', ap_music_theory: 'music', ap_seminar: 'seminar',
};

export function isApFrameworkSubject(subjectCode: string): subjectCode is SubjectCode {
  return Object.hasOwn(FRAMEWORK_META, subjectCode);
}

export function getApFramework(subjectCode: string) {
  if (!isApFrameworkSubject(subjectCode)) return null;
  const subject = SUBJECT_CATALOG[subjectCode];
  const meta = FRAMEWORK_META[subjectCode] as FrameworkMeta;
  const prefix = CODE_PREFIXES[subjectCode] as string;
  return {
    catalogSnapshot: '2026-09-16',
    source: `https://apcentral.collegeboard.org/courses/${meta.slug}`,
    frameworkType: meta.type,
    sections: subject.modules.map((title, index) => ({ code: `${prefix}_u${index + 1}`, number: index + 1, title })),
    practices: meta.practices,
  };
}

export function buildApFrameworkPrompt(subjectCode: string) {
  const framework = getApFramework(subjectCode);
  if (!framework) return null;
  return {
    catalogSnapshot: framework.catalogSnapshot,
    officialSource: framework.source,
    frameworkType: framework.frameworkType,
    allowedSections: framework.sections,
    practices: framework.practices,
    rules: [
      '每个 lesson 的 unitCodes 必须填写一个或多个 allowedSections 中的 code',
      'unitCodes 只标记本节实际教学、练习或检测的考纲部分，不得虚假标记',
      'theme、content、difficulty 和 goal 必须与 unitCodes 指向的考纲内容一致',
      '每节课同时体现至少一项 AP practice 或明确考试任务',
      '考试权重只用于识别重点，不按百分比机械分配课时',
    ],
  };
}

export function reviewApFrameworkCodes(report: { coursePlan: { stages: Array<{ lessons: Array<{ unitCodes?: string[] }> }> } }, subjectCode: string) {
  const framework = getApFramework(subjectCode);
  if (!framework) return [];
  const allowed = new Set(framework.sections.map((section) => section.code));
  const issues: string[] = [];
  report.coursePlan.stages.flatMap((stage) => stage.lessons).forEach((lesson, index) => {
    const codes = Array.isArray(lesson.unitCodes) ? lesson.unitCodes : [];
    if (!codes.length) issues.push(`第 ${index + 1} 节课尚未关联 AP 考纲部分`);
    if (codes.some((code) => !allowed.has(code))) issues.push(`第 ${index + 1} 节课包含当前 AP 科目不存在的考纲编码`);
  });
  return [...new Set(issues)];
}
