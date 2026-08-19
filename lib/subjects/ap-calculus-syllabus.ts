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
  difficulty?: string;
  goal?: string;
  unitCodes?: string[];
}

interface CalculusReport {
  coursePlan: {
    stages: Array<{ title?: string; description?: string; lessons: CalculusLesson[] }>;
  };
}

const CALCULUS_TOPIC_RULES = [
  { code: 'calc_u1', topics: 'limits, continuity, Intermediate Value Theorem', pattern: /\blimits?\b|极限|continuity|连续性|intermediate value theorem|\bIVT\b/i },
  { code: 'calc_u2', topics: 'derivative definition, differentiability, power/product/quotient rules', pattern: /derivative definition|导数定义|difference quotient|差商|differentiability|可导性|power rule|幂函数求导|product rule|乘法求导|quotient rule|商法则|基本求导/i },
  { code: 'calc_u3', topics: 'chain rule, implicit differentiation, inverse functions, higher-order derivatives', pattern: /chain rule|链式法则|implicit differentiation|隐函数求导|inverse function.{0,12}derivative|反函数.{0,8}导数|higher[- ]order derivative|高阶导/i },
  { code: 'calc_u4', topics: 'contextual rates, related rates, motion, linearization', pattern: /related rates?|相关变化率|linearization|linear approximation|线性近似|local linearity|局部线性|position.{0,12}velocity.{0,12}acceleration|位置.{0,8}速度.{0,8}加速度/i },
  { code: 'calc_u5', topics: 'Mean Value Theorem, extrema, optimization, curve analysis, L’Hôpital’s Rule', pattern: /mean value theorem|\bMVT\b|Rolle|optimization|最优化|极值|critical points?|临界点|curve sketch|曲线分析|concavity|凹凸|first derivative test|second derivative test|洛必达|L['’]?H[oô]pital/i },
  { code: 'calc_u6', topics: 'Riemann sums, accumulation, Fundamental Theorem of Calculus, antiderivatives, substitution', pattern: /Riemann|黎曼|accumulation|累积变化|fundamental theorem of calculus|微积分基本定理|\bFTC\b|antiderivative|反导数|不定积分|definite integral|定积分|u[- ]substitution|换元积分/i },
  { code: 'calc_u7', topics: 'differential equations, slope fields, Euler’s method, separable equations, logistic models', pattern: /differential equations?|微分方程|slope fields?|斜率场|Euler|欧拉法|separable|变量分离|logistic|逻辑斯蒂/i },
  { code: 'calc_u8', topics: 'area between curves, volumes, arc length, average value of a function', pattern: /area between curves|曲线之间.{0,6}面积|两曲线.{0,6}面积|cross[- ]sections?|截面.{0,6}体积|volume|旋转体|arc length|弧长|average value of a function|函数平均值/i },
  { code: 'calc_u9', topics: 'parametric equations, polar coordinates, vector-valued functions', pattern: /parametric equations?|参数方程|polar coordinates?|极坐标|vector[- ]valued|向量值函数/i },
  { code: 'calc_u10', topics: 'sequences, infinite series, convergence tests, Taylor and Maclaurin series', pattern: /sequences?|数列|infinite series|无穷级数|convergence tests?|收敛判别|Taylor|泰勒级数|Maclaurin|麦克劳林/i },
];

function extractMentionedUnitCodes(value: string) {
  const numbers = new Set<number>();
  for (const match of value.matchAll(/\bunits?\s*([1-9]|10)\s*[–—-]\s*([1-9]|10)\b/gi)) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    for (let number = Math.min(start, end); number <= Math.max(start, end); number += 1) numbers.add(number);
  }
  for (const match of value.matchAll(/\b(?:unit|u)\s*([1-9]|10)\b/gi)) numbers.add(Number(match[1]));
  return [...numbers].map((number) => `calc_u${number}`);
}

function inferCalculusUnitCodes(value: string) {
  return CALCULUS_TOPIC_RULES.filter((rule) => rule.pattern.test(value)).map((rule) => rule.code);
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
  const validCodes = new Set(getCalculusUnits(subjectCode).map((unit) => unit.code));
  return extractMentionedUnitCodes(notes).filter((code) => validCodes.has(code));
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
      topicSignals: CALCULUS_TOPIC_RULES.find((rule) => rule.code === unit.code)?.topics,
    })),
    requiredUnitCodes: getRequiredCalculusUnits(subjectCode, scenario, notes),
    rules: [
      '每个 lesson 的 unitCodes 必须填写一个或多个合法 Unit code',
      'unitCodes 只标记本节实际教学或检测的 Unit，不得为了通过覆盖检查虚假标记',
      'lesson 的 theme、content、difficulty、goal 中出现的 Calculus 主题必须与 unitCodes 一致',
      '阶段标题、阶段说明和检测课写出的 Unit 范围必须等于该阶段实际覆盖范围',
      'AP Calculus AB 不得出现 calc_u9 或 calc_u10',
      '预习场景只覆盖 requiredUnitCodes，不扩展到未要求的后续 Units',
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
    const lessonText = `${lesson.theme} ${lesson.content} ${lesson.difficulty ?? ''} ${lesson.goal ?? ''}`;
    const semanticCodes = inferCalculusUnitCodes(lessonText);
    const explicitCodes = extractMentionedUnitCodes(lessonText);
    const unmarkedCodes = [...new Set([...semanticCodes, ...explicitCodes])].filter((code) => allowedCodes.has(code) && !unitCodes.includes(code));
    if (unmarkedCodes.length) hardIssues.push(`第 ${index + 1} 节课的内容属于 ${unmarkedCodes.join('、')}，但 unitCodes 未如实标记`);
    const unsupportedCodes = unitCodes.filter((code) => allowedCodes.has(code) && semanticCodes.length > 0 && !semanticCodes.includes(code));
    if (unsupportedCodes.length) hardIssues.push(`第 ${index + 1} 节课标记了与明确内容不一致的 Unit：${unsupportedCodes.join('、')}`);
  });
  report.coursePlan.stages.forEach((stage, stageIndex) => {
    const stageText = `${stage.title ?? ''} ${stage.description ?? ''}`;
    const claimedCodes = extractMentionedUnitCodes(stageText).filter((code) => allowedCodes.has(code));
    if (!claimedCodes.length || !/覆盖|检测|测评|复习|总结|完成/i.test(stageText)) return;
    const actualCodes = [...new Set(stage.lessons.flatMap((lesson) => lesson.unitCodes ?? []).filter((code) => allowedCodes.has(code)))];
    const missingClaims = claimedCodes.filter((code) => !actualCodes.includes(code));
    const omittedActual = actualCodes.filter((code) => !claimedCodes.includes(code));
    if (missingClaims.length || omittedActual.length) {
      hardIssues.push(`第 ${stageIndex + 1} 阶段声称覆盖 ${claimedCodes.join('、')}，与实际课时标记 ${actualCodes.join('、')} 不一致`);
    }
  });
  const requiredCodes = getRequiredCalculusUnits(subjectCode, scenario, notes);
  const missingCodes = requiredCodes.filter((code) => !coveredCodes.has(code));
  if (missingCodes.length) hardIssues.push(`课程规划缺少必须覆盖的 Unit：${missingCodes.join('、')}`);
  if (scenario === 'preview') {
    const extraCodes = [...coveredCodes].filter((code) => !requiredCodes.includes(code));
    if (extraCodes.length) hardIssues.push(`预习规划超出本次要求，额外安排了 Unit：${extraCodes.join('、')}`);
  }
  if (/每(?:完成|学完)\s*\d+\s*个?\s*Units?.{0,16}(?:检测|测评|考试)/i.test(JSON.stringify(report))) {
    hardIssues.push('课程规划承诺了按固定 Unit 数量测评，应改为根据关键概念作答证据安排检测与订正');
  }
  const planText = lessons.map((lesson) => `${lesson.theme} ${lesson.content}`).join(' ');
  if (scenario === 'intensive' && !/MCQ/i.test(planText)) warnings.push('冲刺规划没有明确安排 MCQ 训练');
  if (scenario === 'intensive' && !/FRQ/i.test(planText)) warnings.push('冲刺规划没有明确安排 FRQ 训练');
  if (scenario === 'intensive' && !/模考|practice exam|mock/i.test(planText)) warnings.push('冲刺规划没有明确安排完整模考');
  if (scenario === 'intensive' && !/复盘|讲评|订正|错因/i.test(planText)) warnings.push('冲刺规划没有明确安排模考复盘或错因订正');
  return { hardIssues: [...new Set(hardIssues)], warnings: [...new Set(warnings)] };
}
