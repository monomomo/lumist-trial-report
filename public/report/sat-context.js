export const SAT_MATH_AREA_CONFIG = [
  { code: 'algebra', label: 'Algebra', description: '线性方程、不等式、方程组与线性函数' },
  { code: 'advanced_math', label: 'Advanced Math', description: '非线性方程、函数与等价表达式' },
  { code: 'problem_solving_data_analysis', label: 'Problem-Solving and Data Analysis', description: '比例、百分比、数据分析与概率' },
  { code: 'geometry_trigonometry', label: 'Geometry and Trigonometry', description: '面积体积、圆、直角三角形与三角函数' },
  { code: 'integrated_practice', label: '综合训练、Bluebook 模考与复盘', description: '跨领域训练、整卷检测、错题归因与调整' },
];

export const SAT_MATH_AREA_CODES = SAT_MATH_AREA_CONFIG.map((item) => item.code);

export function createEmptySatMathHours() {
  return Object.fromEntries(SAT_MATH_AREA_CODES.map((code) => [code, '']));
}

export function normalizeSatMathHours(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(SAT_MATH_AREA_CODES.map((code) => [code, Number(source[code])]));
}

export function sumSatMathHours(value) {
  const hours = normalizeSatMathHours(value);
  return SAT_MATH_AREA_CODES.reduce((total, code) => total + (Number.isFinite(hours[code]) ? hours[code] : 0), 0);
}

export function validateSatMathHours(value, totalHours) {
  const source = value && typeof value === 'object' ? value : {};
  const emptyCode = SAT_MATH_AREA_CODES.find((code) => source[code] === '' || source[code] === null || source[code] === undefined);
  if (emptyCode) return { valid: false, code: emptyCode, message: '请填写全部五项课时；不安排的项目请明确填写 0' };
  const hours = normalizeSatMathHours(value);
  const invalidCode = SAT_MATH_AREA_CODES.find((code) => !Number.isFinite(hours[code]) || hours[code] < 0 || hours[code] > 60 || Math.abs(hours[code] * 2 - Math.round(hours[code] * 2)) > 0.001);
  if (invalidCode) return { valid: false, code: invalidCode, message: '每一项都需要填写 0–60 之间、以 0.5 小时递增的数字' };
  const expected = Number(totalHours);
  const assigned = sumSatMathHours(hours);
  if (!Number.isFinite(expected)) return { valid: false, code: 'total', message: '请先填写总课时' };
  if (Math.abs(assigned - expected) > 0.001) return { valid: false, code: 'total', message: `五项合计 ${assigned}h，与总课时 ${expected}h 不一致` };
  return { valid: true, hours, assigned };
}

export function suggestSatMathHours(totalHours) {
  const total = Number(totalHours);
  if (!Number.isFinite(total) || total < 2 || total > 60 || Math.abs(total * 2 - Math.round(total * 2)) > 0.001) return null;
  const units = Math.round(total * 2);
  const integratedUnits = Math.max(1, Math.round(units * 0.2));
  const contentUnits = units - integratedUnits;
  const weights = [0.35, 0.35, 0.15, 0.15];
  const raw = weights.map((weight) => contentUnits * weight);
  const allocated = raw.map(Math.floor);
  let remainder = contentUnits - allocated.reduce((sum, item) => sum + item, 0);
  raw.map((item, index) => ({ index, fraction: item - allocated[index] }))
    .sort((first, second) => second.fraction - first.fraction || first.index - second.index)
    .forEach(({ index }) => {
      if (remainder <= 0) return;
      allocated[index] += 1;
      remainder -= 1;
    });
  return {
    algebra: allocated[0] / 2,
    advanced_math: allocated[1] / 2,
    problem_solving_data_analysis: allocated[2] / 2,
    geometry_trigonometry: allocated[3] / 2,
    integrated_practice: integratedUnits / 2,
  };
}

export function buildSatMathLessonAllocations(value, lessonDurations) {
  const hours = normalizeSatMathHours(value);
  const chunks = SAT_MATH_AREA_CODES.flatMap((code) => Array.from({ length: Math.round(hours[code] * 2) }, () => code));
  const integrated = chunks.filter((code) => code === 'integrated_practice');
  const content = chunks.filter((code) => code !== 'integrated_practice');
  const ordered = [...content];
  integrated.forEach((code, index) => {
    const position = Math.min(ordered.length, Math.round(((index + 1) * ordered.length) / (integrated.length + 1)) + index);
    ordered.splice(position, 0, code);
  });
  let cursor = 0;
  return lessonDurations.map((duration) => {
    const unitCount = Math.round(Number(duration) * 2);
    const lessonCodes = ordered.slice(cursor, cursor + unitCount);
    cursor += unitCount;
    return SAT_MATH_AREA_CODES.flatMap((code) => {
      const count = lessonCodes.filter((item) => item === code).length;
      return count ? [{ code, hours: count / 2 }] : [];
    });
  });
}

export function validateSatEnglishAssessment(value) {
  if (!value || typeof value !== 'object' || !value.testType) return { valid: true, assessment: null };
  const overallScore = Number(value.overallScore);
  const hasReading = value.readingScore !== '' && value.readingScore !== null && value.readingScore !== undefined;
  const readingScore = hasReading ? Number(value.readingScore) : null;
  const halfStep = (score) => Math.abs(score * 2 - Math.round(score * 2)) < 0.001;
  if (value.testType === 'toefl_ibt') {
    if (!['new_1_6', 'legacy_0_120'].includes(value.scoreScale)) return { valid: false, field: 'scale', message: '请选择 TOEFL 成绩分制' };
    if (value.scoreScale === 'new_1_6') {
      if (!Number.isFinite(overallScore) || overallScore < 1 || overallScore > 6 || !halfStep(overallScore)) return { valid: false, field: 'overall', message: 'TOEFL 新制总分应为 1–6，支持 0.5 分档' };
      if (hasReading && (!Number.isFinite(readingScore) || readingScore < 1 || readingScore > 6 || !halfStep(readingScore))) return { valid: false, field: 'reading', message: 'TOEFL 新制阅读应为 1–6，支持 0.5 分档' };
    } else {
      if (!Number.isInteger(overallScore) || overallScore < 0 || overallScore > 120) return { valid: false, field: 'overall', message: 'TOEFL 旧制总分应为 0–120 的整数' };
      if (hasReading && (!Number.isInteger(readingScore) || readingScore < 0 || readingScore > 30)) return { valid: false, field: 'reading', message: 'TOEFL 旧制阅读应为 0–30 的整数' };
    }
  } else if (value.testType === 'ielts_academic') {
    if (!Number.isFinite(overallScore) || overallScore < 0 || overallScore > 9 || !halfStep(overallScore)) return { valid: false, field: 'overall', message: 'IELTS 总分应为 0–9，支持 0.5 分档' };
    if (hasReading && (!Number.isFinite(readingScore) || readingScore < 0 || readingScore > 9 || !halfStep(readingScore))) return { valid: false, field: 'reading', message: 'IELTS 阅读应为 0–9，支持 0.5 分档' };
  } else {
    return { valid: false, field: 'type', message: '请选择有效的语言考试' };
  }
  return {
    valid: true,
    assessment: {
      testType: value.testType,
      scoreScale: value.testType === 'ielts_academic' ? 'ielts_0_9' : value.scoreScale,
      overallScore,
      ...(hasReading ? { readingScore } : {}),
      ...(String(value.testDate || '').trim() ? { testDate: String(value.testDate).trim() } : {}),
    },
  };
}
