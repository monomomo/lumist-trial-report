import { SUBJECT_CATALOG, type SubjectCode } from './catalog.js';

type FrameworkType = 'units' | 'bigIdeas' | 'skillAreas';

type FrameworkMeta = {
  slug: string;
  type: FrameworkType;
  practices: string[];
  rules?: string[];
  additionalSlugs?: string[];
};

const CALCULUS_PRACTICES = ['Determine expressions and values using mathematical procedures and rules', 'Translate mathematical information within and across representations', 'Justify reasoning and solutions', 'Communicate results using correct notation, language, and mathematical conventions'];
const PHYSICS_PRACTICES = ['Creating Representations', 'Mathematical Routines', 'Scientific Questioning and Argumentation'];
const HISTORY_PRACTICES = ['Developments and processes', 'Sourcing and situation', 'Claims and evidence', 'Contextualization', 'Making connections', 'Argumentation'];

const FRAMEWORK_META: Partial<Record<SubjectCode, FrameworkMeta>> = {
  ap_calculus_ab: { slug: 'ap-calculus-ab', type: 'units', practices: CALCULUS_PRACTICES },
  ap_calculus_bc: { slug: 'ap-calculus-bc', type: 'units', practices: CALCULUS_PRACTICES },
  ap_precalculus: { slug: 'ap-precalculus', type: 'units', practices: ['Procedural and Symbolic Fluency', 'Multiple Representations', 'Communication and Reasoning'], rules: ['Unit 4 Functions Involving Parameters, Vectors, and Matrices 不纳入 AP Exam，不得作为统考提分覆盖或模考考点'] },
  ap_statistics: { slug: 'ap-statistics', type: 'units', practices: ['Formulate Questions', 'Collect Data', 'Analyze Data', 'Interpret Results'], rules: ['使用 2026–27 学年起实施的五单元框架', '不得安排 analyzing departures from linearity、combining random variables、geometric distribution、chi-square goodness of fit test 或 inference for slopes 作为 AP 统考内容'] },
  ap_csa: { slug: 'ap-computer-science-a', type: 'units', practices: ['Design code', 'Develop code', 'Analyze code', 'Document code and computing systems', 'Use computers responsibly'] },
  ap_csp: { slug: 'ap-computer-science-principles', type: 'bigIdeas', practices: ['Computational Solution Design', 'Algorithms and Program Development', 'Abstraction in Program Development', 'Code Analysis', 'Computing Innovations', 'Responsible Computing'], rules: ['Create Performance Task 是 through-course assessment，不是第六个 Big Idea'] },
  ap_physics_1: { slug: 'ap-physics-1', type: 'units', practices: PHYSICS_PRACTICES },
  ap_physics_2: { slug: 'ap-physics-2', type: 'units', practices: PHYSICS_PRACTICES },
  ap_physics_c_mechanics: { slug: 'ap-physics-c-mechanics', type: 'units', practices: PHYSICS_PRACTICES },
  ap_physics_c_electricity_magnetism: { slug: 'ap-physics-c-electricity-and-magnetism', type: 'units', practices: PHYSICS_PRACTICES },
  ap_chemistry: { slug: 'ap-chemistry', type: 'units', practices: ['Models and Representations', 'Question and Method', 'Representing Data and Phenomena', 'Model Analysis', 'Mathematical Routines', 'Argumentation'] },
  ap_biology: { slug: 'ap-biology', type: 'units', practices: ['Concept Explanation', 'Visual Representations', 'Questions and Methods', 'Representing and Describing Data', 'Statistical Tests and Data Analysis', 'Argumentation'] },
  ap_environmental_science: { slug: 'ap-environmental-science', type: 'units', practices: ['Concept Explanation', 'Visual Representations', 'Text Analysis', 'Scientific Experiments', 'Data Analysis', 'Mathematical Routines', 'Environmental Solutions'] },
  ap_microeconomics: { slug: 'ap-microeconomics', type: 'units', practices: ['Principles and models', 'Interpretation', 'Manipulation', 'Graphing and visuals'] },
  ap_macroeconomics: { slug: 'ap-macroeconomics', type: 'units', practices: ['Principles and models', 'Interpretation', 'Manipulation', 'Graphing and visuals'] },
  ap_micro_macro_economics: { slug: 'ap-microeconomics', additionalSlugs: ['ap-macroeconomics'], type: 'units', practices: ['Principles and models', 'Interpretation', 'Manipulation', 'Graphing and visuals'] },
  ap_business_personal_finance: { slug: 'ap-business-personal-finance', type: 'units', practices: ['Concept application', 'Entrepreneurship', 'Decision making', 'Communication', 'Collaboration'], rules: ['Unit 1–4 纳入 AP Exam；Unit 5 不纳入 AP Exam', 'Business Canvas Project Exam-Day Validation、Personal Finance FRQ、Business Concept Application FRQ 和 Business Decision FRQ 属于考试任务，不是额外课程单元'] },
  ap_us_history: { slug: 'ap-united-states-history', type: 'units', practices: HISTORY_PRACTICES },
  ap_world_history: { slug: 'ap-world-history', type: 'units', practices: HISTORY_PRACTICES },
  ap_european_history: { slug: 'ap-european-history', type: 'units', practices: HISTORY_PRACTICES },
  ap_psychology: { slug: 'ap-psychology', type: 'units', practices: ['Concept application', 'Research methods and design', 'Data interpretation', 'Argumentation'] },
  ap_human_geography: { slug: 'ap-human-geography', type: 'units', practices: ['Concepts and Processes', 'Spatial Relationships', 'Data Analysis', 'Source Analysis', 'Scale Analysis'] },
  ap_comparative_government: { slug: 'ap-comparative-government-and-politics', type: 'units', practices: ['Concept Application', 'Country Comparison', 'Data Analysis', 'Source Analysis', 'Argumentation'], rules: ['中国、伊朗、墨西哥、尼日利亚、俄罗斯和英国的国家案例贯穿五个单元，不构成第六个 Comparative Case Studies 单元'] },
  ap_us_government: { slug: 'ap-united-states-government-and-politics', type: 'units', practices: ['Concept Application', 'SCOTUS Application', 'Data Analysis', 'Source Analysis', 'Argumentation'], rules: ['使用 Fall 2026 CED，并纳入 2026–27 新增的四份 required foundational documents'] },
  ap_english_literature: { slug: 'ap-english-literature-and-composition', type: 'units', practices: ['Character', 'Setting', 'Plot and Structure', 'Narrator or Speaker', 'Word Choice, Imagery, and Symbols', 'Comparison', 'Literary Argumentation'] },
  ap_english_language: { slug: 'ap-english-language-and-composition', type: 'skillAreas', practices: ['Rhetorical Situation: Reading', 'Rhetorical Situation: Writing', 'Claims and Evidence: Reading', 'Claims and Evidence: Writing', 'Reasoning and Organization: Reading', 'Reasoning and Organization: Writing', 'Style: Reading', 'Style: Writing'] },
  ap_art_history: { slug: 'ap-art-history', type: 'units', practices: ['Visual Analysis', 'Contextual Analysis', 'Comparison of Works of Art', 'Artistic Traditions', 'Visual Analysis of Unknown Works', 'Attribution of Unknown Works', 'Art Historical Interpretations', 'Argumentation'] },
  ap_chinese: { slug: 'ap-chinese-language-and-culture', type: 'units', practices: ['Interpretive Communication', 'Interpersonal and Presentational Communication', 'Cultural Understanding'], rules: ['使用 2026–27 学年起实施的六单元框架和课程项目要求，不得沿用 Personal and Public Identities、Beauty and Aesthetics、Global Challenges 等旧主题名称'] },
  ap_latin: { slug: 'ap-latin', type: 'units', practices: ['Read and Comprehend', 'Describe Style and Context', 'Analyze'], rules: ['使用 2025–26 学年起实施的 Pliny、Vergil、Teacher’s Choice 和 Course Project 六单元框架，不得沿用旧版 Caesar 与 Vergil 双文本框架'] },
  ap_music_theory: { slug: 'ap-music-theory', type: 'units', practices: ['Analyze Performed Music', 'Analyze Notated Music', 'Convert Between Performed and Notated Music', 'Complete Based on Cues'], rules: ['Aural Skills、part writing 和 sight singing 应贯穿对应单元，不得标记成额外官方单元'] },
  ap_seminar: { slug: 'ap-seminar', type: 'bigIdeas', practices: ['Question and Explore', 'Understand and Analyze', 'Evaluate Multiple Perspectives', 'Synthesize Ideas', 'Team, Transform, and Transmit'], rules: ['Team Project and Presentation、Individual Research-Based Essay and Presentation 与 End-of-Course Exam 是评估组成，不是额外 Big Ideas'] },
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
    catalogSnapshot: '2026-10-02',
    effectiveSchoolYear: '2026-27',
    source: `https://apcentral.collegeboard.org/courses/${meta.slug}`,
    sources: [meta.slug, ...(meta.additionalSlugs ?? [])].map((slug) => `https://apcentral.collegeboard.org/courses/${slug}`),
    frameworkType: meta.type,
    sections: subject.modules.map((title, index) => ({ code: `${prefix}_u${index + 1}`, number: index + 1, title })),
    practices: meta.practices,
    subjectRules: meta.rules ?? [],
  };
}

export function buildApFrameworkPrompt(subjectCode: string) {
  const framework = getApFramework(subjectCode);
  if (!framework) return null;
  return {
    catalogSnapshot: framework.catalogSnapshot,
    effectiveSchoolYear: framework.effectiveSchoolYear,
    officialSource: framework.source,
    officialSources: framework.sources,
    frameworkType: framework.frameworkType,
    allowedSections: framework.sections,
    practices: framework.practices,
    rules: [
      '每个 lesson 的 unitCodes 必须填写一个或多个 allowedSections 中的 code',
      'unitCodes 只标记本节实际教学、练习或检测的考纲部分，不得虚假标记',
      'theme、content、difficulty 和 goal 必须与 unitCodes 指向的考纲内容一致',
      '每节课同时体现至少一项 AP practice 或明确考试任务',
      '考试权重只用于识别重点，不按百分比机械分配课时',
      ...framework.subjectRules,
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
