function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function normalizeGenerationInput(input) {
  const source = input.source === 'upload' ? 'upload' : 'ai';
  return {
    source,
    subjectCode: String(input.subjectCode || ''),
    studentName: String(input.studentName || '').trim(),
    currentScore: String(input.currentScore || '').trim(),
    targetScore: String(input.targetScore || '').trim(),
    examDate: String(input.examDate || '').trim(),
    totalHours: Number(input.totalHours),
    lessonCount: Number(input.lessonCount),
    planningScenario: source === 'ai' ? String(input.planningScenario || 'synchronous') : 'synchronous',
    planningFocusAreas: source === 'ai' ? [...new Set(input.planningFocusAreas || [])].sort() : [],
    includeExamTraining: source === 'ai' && input.includeExamTraining === true,
    teacherNotes: String(input.teacherNotes || '').trim(),
    ...(source === 'ai' && input.subjectCode === 'sat_english' && input.satEnglishAssessment ? { satEnglishAssessment: canonical(input.satEnglishAssessment) } : {}),
    ...(source === 'ai' && input.subjectCode === 'sat_math' && input.satMathHours ? { satMathHours: canonical(input.satMathHours) } : {}),
  };
}

export function sameCoursePlan(first, second) {
  const normalize = (plan) => canonical({
    ...plan,
    rationale: plan.rationale === '本课程规划由任课老师上传并确认，课次顺序、课程内容与时长均按原文件保留。' ? '' : (plan.rationale || ''),
  });
  return Boolean(first && second) && JSON.stringify(normalize(first)) === JSON.stringify(normalize(second));
}

export function getGenerationAction(previous, next, { forceNewPlan = false } = {}) {
  if (!previous || forceNewPlan) return 'new-plan';
  const previousInput = normalizeGenerationInput(previous);
  const nextInput = normalizeGenerationInput(next);
  if (JSON.stringify(previousInput) === JSON.stringify(nextInput)) return 'reuse';
  const { teacherNotes: previousNotes, studentName: previousName, ...previousConstraints } = previousInput;
  const { teacherNotes: nextNotes, studentName: nextName, ...nextConstraints } = nextInput;
  return JSON.stringify(previousConstraints) === JSON.stringify(nextConstraints) ? 'summary-only' : 'new-plan';
}
