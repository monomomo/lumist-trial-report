type CalculusSubjectCode = 'ap_calculus_ab' | 'ap_calculus_bc';

interface CalculusUnit {
  code: string;
  number: number;
  title: string;
  examWeight: { minimum: number; maximum: number };
  courses: CalculusSubjectCode[];
}

interface CalculusLesson {
  theme: string;
  content: string;
  unitCodes?: string[];
}

interface CalculusReport {
  coursePlan: {
    stages: Array<{ lessons: CalculusLesson[] }>;
  };
}

const SHARED_UNITS: CalculusUnit[] = [
  { code: 'calc_u1', number: 1, title: 'Limits and Continuity', examWeight: { minimum: 10, maximum: 15 }, courses: ['ap_calculus_ab', 'ap_calculus_bc'] },
  { code: 'calc_u2', number: 2, title: 'Differentiation: Definition and Fundamental Properties', examWeight: { minimum: 10, maximum: 15 }, courses: ['ap_calculus_ab', 'ap_calculus_bc'] },
  { code: 'calc_u3', number: 3, title: 'Differentiation: Composite, Implicit, and Inverse Functions', examWeight: { minimum: 5, maximum: 10 }, courses: ['ap_calculus_ab', 'ap_calculus_bc'] },
  { code: 'calc_u4', number: 4, title: 'Contextual Applications of Differentiation', examWeight: { minimum: 10, maximum: 15 }, courses: ['ap_calculus_ab', 'ap_calculus_bc'] },
  { code: 'calc_u5', number: 5, title: 'Analytical Applications of Differentiation', examWeight: { minimum: 15, maximum: 20 }, courses: ['ap_calculus_ab', 'ap_calculus_bc'] },
  { code: 'calc_u6', number: 6, title: 'Integration and Accumulation of Change', examWeight: { minimum: 15, maximum: 20 }, courses: ['ap_calculus_ab', 'ap_calculus_bc'] },
  { code: 'calc_u7', number: 7, title: 'Differential Equations', examWeight: { minimum: 5, maximum: 10 }, courses: ['ap_calculus_ab', 'ap_calculus_bc'] },
  { code: 'calc_u8', number: 8, title: 'Applications of Integration', examWeight: { minimum: 10, maximum: 15 }, courses: ['ap_calculus_ab', 'ap_calculus_bc'] },
];

const BC_UNITS: CalculusUnit[] = [
  { code: 'calc_u9', number: 9, title: 'Parametric Equations, Polar Coordinates, and Vector-Valued Functions', examWeight: { minimum: 11, maximum: 12 }, courses: ['ap_calculus_bc'] },
  { code: 'calc_u10', number: 10, title: 'Infinite Sequences and Series', examWeight: { minimum: 17, maximum: 18 }, courses: ['ap_calculus_bc'] },
];

const BC_WEIGHTS = new Map<number, CalculusUnit['examWeight']>([
  [1, { minimum: 4, maximum: 7 }],
  [2, { minimum: 4, maximum: 7 }],
  [3, { minimum: 4, maximum: 7 }],
  [4, { minimum: 6, maximum: 9 }],
  [5, { minimum: 8, maximum: 11 }],
  [6, { minimum: 17, maximum: 20 }],
  [7, { minimum: 6, maximum: 9 }],
  [8, { minimum: 6, maximum: 9 }],
]);

export function isCalculusPilotSubject(subjectCode: string): subjectCode is CalculusSubjectCode {
  return subjectCode === 'ap_calculus_ab' || subjectCode === 'ap_calculus_bc';
}

export function getCalculusUnits(subjectCode: string): CalculusUnit[] {
  if (!isCalculusPilotSubject(subjectCode)) return [];
  const units = subjectCode === 'ap_calculus_bc' ? [...SHARED_UNITS, ...BC_UNITS] : SHARED_UNITS;
  return units.map((unit) => ({
    ...unit,
    examWeight: subjectCode === 'ap_calculus_bc' && BC_WEIGHTS.has(unit.number)
      ? BC_WEIGHTS.get(unit.number) as CalculusUnit['examWeight']
      : unit.examWeight,
  }));
}

export function extractExplicitCalculusUnits(notes: string, subjectCode: string): string[] {
  const validNumbers = new Set(getCalculusUnits(subjectCode).map((unit) => unit.number));
  const matches = [...notes.matchAll(/\b(?:unit|u)\s*([1-9]|10)\b/gi)];
  return [...new Set(matches.map((match) => Number(match[1])).filter((number) => validNumbers.has(number)).map((number) => `calc_u${number}`))];
}

export function getRequiredCalculusUnits(subjectCode: string, scenario: string, notes: string): string[] {
  const units = getCalculusUnits(subjectCode);
  if (!units.length) return [];
  if (scenario === 'intensive') return units.map((unit) => unit.code);
  const explicitUnits = extractExplicitCalculusUnits(notes, subjectCode);
  if (explicitUnits.length) return explicitUnits;
  if (scenario === 'preview') return units.slice(0, 3).map((unit) => unit.code);
  return [];
}

export function buildCalculusSyllabusPrompt(subjectCode: string, scenario: string, notes: string) {
  const units = getCalculusUnits(subjectCode);
  if (!units.length) return null;
  return {
    allowedUnits: units.map((unit) => ({
      code: unit.code,
      number: unit.number,
      title: unit.title,
      examWeight: `${unit.examWeight.minimum}%–${unit.examWeight.maximum}%`,
    })),
    requiredUnitCodes: getRequiredCalculusUnits(subjectCode, scenario, notes),
    rules: [
      '每个 lesson 的 unitCodes 必须填写一个或多个合法 Unit code',
      'unitCodes 只标记本节实际教学或检测的 Unit，不得为了通过覆盖检查虚假标记',
      'AP Calculus AB 不得出现 calc_u9 或 calc_u10',
      '冲刺场景必须在课程规划中覆盖全部合法 Units',
    ],
  };
}

export function reviewCalculusSyllabusCoverage(report: CalculusReport, subjectCode: string, scenario: string, notes: string) {
  if (!isCalculusPilotSubject(subjectCode)) return { hardIssues: [], warnings: [] };
  const units = getCalculusUnits(subjectCode);
  const allowedCodes = new Set(units.map((unit) => unit.code));
  const lessons = report.coursePlan.stages.flatMap((stage) => stage.lessons);
  const hardIssues: string[] = [];
  const warnings: string[] = [];
  const coveredCodes = new Set<string>();
  lessons.forEach((lesson, index) => {
    const unitCodes = Array.isArray(lesson.unitCodes) ? lesson.unitCodes : [];
    if (!unitCodes.length) hardIssues.push(`第 ${index + 1} 节课缺少 Calculus Unit 标记`);
    unitCodes.forEach((code) => {
      if (!allowedCodes.has(code)) hardIssues.push(`第 ${index + 1} 节课包含当前科目不允许的 Unit：${code}`);
      else coveredCodes.add(code);
    });
  });
  const requiredCodes = getRequiredCalculusUnits(subjectCode, scenario, notes);
  const missingCodes = requiredCodes.filter((code) => !coveredCodes.has(code));
  if (missingCodes.length) hardIssues.push(`课程规划缺少必须覆盖的 Unit：${missingCodes.join('、')}`);
  const planText = lessons.map((lesson) => `${lesson.theme} ${lesson.content}`).join(' ');
  if (scenario === 'intensive' && !/MCQ/i.test(planText)) warnings.push('冲刺规划没有明确安排 MCQ 训练');
  if (scenario === 'intensive' && !/FRQ/i.test(planText)) warnings.push('冲刺规划没有明确安排 FRQ 训练');
  if (scenario === 'intensive' && !/模考|practice exam|mock/i.test(planText)) warnings.push('冲刺规划没有明确安排完整模考');
  if (scenario === 'intensive' && !/复盘|讲评|订正|错因/i.test(planText)) warnings.push('冲刺规划没有明确安排模考复盘或错因订正');
  return { hardIssues: [...new Set(hardIssues)], warnings: [...new Set(warnings)] };
}
