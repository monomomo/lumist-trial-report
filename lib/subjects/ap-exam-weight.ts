import { SUBJECT_CATALOG, type SubjectCode } from './catalog.js';
import { getCalculusUnits } from './ap-calculus-syllabus.js';

type ExamWeightProfile = {
  sectionWeights?: string[];
  sectionLabels?: string[];
  assessmentBreakdown?: string;
};

const AP_EXAM_WEIGHT_PROFILES: Partial<Record<SubjectCode, ExamWeightProfile>> = {
  ap_precalculus:{sectionWeights:['30%–40%','25%–40%','30%–35%','不纳入 AP Exam']},
  ap_statistics:{sectionWeights:['20%–30%','15%–25%','15%–25%','10%–20%','10%–20%']},
  ap_csa:{sectionWeights:['15%–25%','25%–35%','10%–18%','30%–40%']},
  ap_csp:{sectionWeights:['10%–13%','17%–22%','30%–35%','11%–15%','21%–26%'],sectionLabels:['Big Idea 1','Big Idea 2','Big Idea 3','Big Idea 4','Big Idea 5']},
  ap_physics_1:{sectionWeights:['10%–15%','18%–23%','18%–23%','10%–15%','10%–15%','5%–8%','5%–8%','10%–15%']},
  ap_physics_2:{sectionWeights:['15%–18%','15%–18%','15%–18%','12%–15%','12%–15%','12%–15%','12%–15%'],sectionLabels:['U9','U10','U11','U12','U13','U14','U15']},
  ap_physics_c_mechanics:{sectionWeights:['10%–15%','20%–25%','15%–25%','10%–20%','10%–15%','10%–15%','10%–15%']},
  ap_physics_c_electricity_magnetism:{sectionWeights:['15%–25%','10%–20%','10%–15%','15%–25%','10%–20%','10%–20%'],sectionLabels:['U8','U9','U10','U11','U12','U13']},
  ap_chemistry:{sectionWeights:['7%–9%','7%–9%','18%–22%','7%–9%','7%–9%','7%–9%','7%–9%','11%–15%','7%–9%']},
  ap_biology:{sectionWeights:['8%–11%','10%–13%','12%–16%','10%–15%','8%–11%','12%–16%','13%–20%','10%–15%']},
  ap_environmental_science:{sectionWeights:['6%–8%','6%–8%','10%–15%','10%–15%','10%–15%','10%–15%','7%–10%','7%–10%','15%–20%']},
  ap_microeconomics:{sectionWeights:['12%–15%','20%–25%','22%–25%','15%–22%','10%–13%','8%–13%']},
  ap_macroeconomics:{sectionWeights:['5%–10%','12%–17%','17%–27%','18%–23%','20%–30%','10%–13%']},
  ap_micro_macro_economics:{sectionWeights:['Micro U1 12%–15%；Macro U1 5%–10%','Micro U2 20%–25%；Macro U1 5%–10%','Micro U3 22%–25%；U4 15%–22%','Micro U5 10%–13%；U6 8%–13%','Macro U2 12%–17%；U3 17%–27%','Macro U4 18%–23%；U5 20%–30%','Macro U6 10%–13%']},
  ap_business_personal_finance:{assessmentBreakdown:'MCQ 60%；Business Canvas Project 现场验证 15%；其余 FRQ 25%'},
  ap_us_history:{sectionWeights:['4%–6%','6%–8%','10%–17%','10%–17%','10%–17%','10%–17%','10%–17%','10%–17%','4%–6%']},
  ap_world_history:{sectionWeights:['8%–10%','8%–10%','12%–15%','12%–15%','12%–15%','12%–15%','8%–10%','8%–10%','8%–10%']},
  ap_european_history:{sectionWeights:['10%–15%','10%–15%','10%–15%','10%–15%','10%–15%','10%–15%','10%–15%','10%–15%','10%–15%']},
  ap_psychology:{sectionWeights:['15%–25%','15%–25%','15%–25%','15%–25%','15%–25%']},
  ap_human_geography:{sectionWeights:['8%–10%','12%–17%','12%–17%','12%–17%','12%–17%','12%–17%','12%–17%']},
  ap_comparative_government:{sectionWeights:['18%–27%','22%–33%','11%–18%','13%–18%','16%–24%']},
  ap_us_government:{sectionWeights:['15%–22%','25%–36%','13%–18%','10%–15%','20%–27%']},
  ap_english_literature:{sectionWeights:['42%–49%','36%–45%','15%–18%','42%–49%','36%–45%','15%–18%','42%–49%','36%–45%','15%–18%'],sectionLabels:['Short Fiction','Poetry','Longer Fiction or Drama','Short Fiction','Poetry','Longer Fiction or Drama','Short Fiction','Poetry','Longer Fiction or Drama']},
  ap_english_language:{sectionWeights:['11%–14%','11%–14%','13%–16%','11%–14%','13%–16%','11%–14%','11%–14%','11%–14%'],sectionLabels:['Rhetorical Situation: Reading','Rhetorical Situation: Writing','Claims and Evidence: Reading','Claims and Evidence: Writing','Reasoning and Organization: Reading','Reasoning and Organization: Writing','Style: Reading','Style: Writing']},
  ap_art_history:{sectionWeights:['约 4%','约 15%','约 21%','约 21%','约 6%','约 6%','约 4%','约 8%','约 4%','约 11%']},
  ap_chinese:{assessmentBreakdown:'项目展示 20%；项目问答 15%；故事叙述 7.5%；邮件回复 7.5%；听力 25%；阅读 25%'},
  ap_latin:{assessmentBreakdown:'选择题 50%；自由作答 50%；课程项目检查点另计 2%'},
  ap_music_theory:{assessmentBreakdown:'选择题 45%；书面自由作答 45%；视唱 10%'},
  ap_seminar:{assessmentBreakdown:'团队项目与展示 20%；个人研究论文与展示 35%；期末考试 45%'},
};

const AP_SECTION_PREFIXES: Partial<Record<SubjectCode, string>> = {
  ap_calculus_ab:'calc',ap_calculus_bc:'calc',ap_precalculus:'precalc',ap_statistics:'stats',ap_csa:'csa',ap_csp:'csp',ap_physics_1:'phys1',ap_physics_2:'phys2',ap_physics_c_mechanics:'physcm',ap_physics_c_electricity_magnetism:'physce',ap_chemistry:'chem',ap_biology:'bio',ap_environmental_science:'apes',ap_microeconomics:'micro',ap_macroeconomics:'macro',ap_micro_macro_economics:'econ',ap_business_personal_finance:'bpf',ap_us_history:'apush',ap_world_history:'whap',ap_european_history:'euro',ap_psychology:'psych',ap_human_geography:'hug',ap_comparative_government:'compgov',ap_us_government:'usgov',ap_english_literature:'lit',ap_english_language:'lang',ap_art_history:'arth',ap_chinese:'chn',ap_latin:'latin',ap_music_theory:'music',ap_seminar:'seminar',
};

export function getApExamWeightProfile(subjectCode: string): ExamWeightProfile | null {
  if (subjectCode === 'ap_calculus_ab' || subjectCode === 'ap_calculus_bc') {
    return {sectionWeights:getCalculusUnits(subjectCode).map((unit) => `${unit.examWeight.minimum}%–${unit.examWeight.maximum}%`)};
  }
  return AP_EXAM_WEIGHT_PROFILES[subjectCode as SubjectCode] ?? null;
}

export function formatApStageExamWeight(subjectCode: string, unitCodes: string[]): string | undefined {
  const profile = getApExamWeightProfile(subjectCode);
  if (!profile) return undefined;
  if (subjectCode === 'ap_business_personal_finance' && unitCodes.length && unitCodes.every((code) => code.endsWith('_u5'))) return 'Unit 5 不纳入 AP Exam';
  if (profile.sectionWeights?.length) {
    const entries = unitCodes.flatMap((code) => {
      const number = Number(code.match(/_u(\d+)$/)?.[1]);
      const weight = profile.sectionWeights?.[number - 1];
      if (!number || !weight) return [];
      const label = profile.sectionLabels?.[number - 1] ?? `U${number}`;
      return [`${label} ${weight}`];
    });
    const unique = [...new Set(entries)];
    if (unique.length) {
      const visible = unique.slice();
      let result = '';
      while (visible.length) {
        const suffix = unique.length > visible.length ? `；另含 ${unique.length - visible.length} 个考纲部分` : '';
        result = `对应完整考纲部分的官方权重：${visible.join('；')}${suffix}`;
        if (result.length <= 160) return result;
        visible.pop();
      }
    }
  }
  if (!profile.assessmentBreakdown) return undefined;
  const unitFiveNote = subjectCode === 'ap_business_personal_finance' && unitCodes.some((code) => code.endsWith('_u5')) ? '；Unit 5 不纳入 AP Exam' : '';
  return `本科目官方考试组成：${profile.assessmentBreakdown}${unitFiveNote}`;
}

export function inferApSectionCodes(subjectCode: string, value: string): string[] {
  const subject = SUBJECT_CATALOG[subjectCode as SubjectCode];
  const prefix = AP_SECTION_PREFIXES[subjectCode as SubjectCode];
  if (!subject || !prefix) return [];
  const numbers = new Set<number>();
  for (const match of value.matchAll(/\b(?:unit|big idea|period|u)\s*0*(\d{1,2})\b/gi)) numbers.add(Number(match[1]));
  const normalizedValue = value.toLowerCase().replace(/[’']/g, "'");
  subject.modules.forEach((title, index) => {
    const normalizedTitle = title.toLowerCase().replace(/[’']/g, "'");
    if (normalizedTitle.length >= 8 && normalizedValue.includes(normalizedTitle)) numbers.add(index + 1);
  });
  return [...numbers].filter((number) => number >= 1 && number <= subject.modules.length).map((number) => `${prefix}_u${number}`);
}

export function verifyApExamWeightCoverage() {
  return Object.keys(SUBJECT_CATALOG).filter((code) => code.startsWith('ap_') && !getApExamWeightProfile(code));
}
