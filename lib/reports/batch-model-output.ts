function limitText(value: unknown, maximum: number) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 1).replace(/[，。；、,:：\s]+$/g, '')}。`;
}

function normalizeList(value: unknown, maximumItems: number, maximumLength: number) {
  if (!Array.isArray(value)) return value;
  return value.slice(0, maximumItems).map((item) => limitText(item, maximumLength));
}

function normalizeLessonCount(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return value;
  return Number(value);
}

export function normalizeOutlineResult(value: unknown) {
  if (!value || typeof value !== 'object') return value;
  const outline = value as Record<string, unknown>;
  const stages = Array.isArray(outline.stages) ? outline.stages : outline.stages;
  return {
    ...outline,
    overview: limitText(outline.overview, 500),
    classroomStatus: limitText(outline.classroomStatus, 160),
    strength: limitText(outline.strength, 160),
    currentFocus: limitText(outline.currentFocus, 180),
    lessonTitle: limitText(outline.lessonTitle, 80),
    lessonSummary: limitText(outline.lessonSummary, 400),
    performance: limitText(outline.performance, 300),
    outcomes: normalizeList(outline.outcomes, 5, 120),
    priorityAreas: normalizeList(outline.priorityAreas, 6, 80),
    rationale: limitText(outline.rationale, 180),
    stages: Array.isArray(stages) ? stages.slice(0, 8).map((stage) => {
      if (!stage || typeof stage !== 'object') return stage;
      const item = stage as Record<string, unknown>;
      return {
        ...item,
        title: limitText(item.title, 50),
        description: limitText(item.description, 100),
        lessonCount: normalizeLessonCount(item.lessonCount),
      };
    }) : stages,
  };
}

function normalizeUnitCode(value: unknown, allowedUnitCodes: string[]) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  const direct = allowedUnitCodes.find((code) => code.toLowerCase() === normalized.toLowerCase());
  if (direct) return direct;
  const embedded = allowedUnitCodes.find((code) => new RegExp(`(?:^|\\s)${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s)`, 'i').test(normalized));
  if (embedded) return embedded;
  const unitNumber = normalized.match(/(?:unit|u)\s*0*(\d{1,2})\b/i)?.[1];
  if (!unitNumber) return normalized;
  return allowedUnitCodes.find((code) => code.toLowerCase().endsWith(`_u${Number(unitNumber)}`)) || normalized;
}

export function normalizeStageResult(value: unknown, allowedUnitCodes: string[]) {
  if (!value || typeof value !== 'object' || !('lessons' in value) || !Array.isArray(value.lessons)) return value;
  const isApSubject = allowedUnitCodes.length > 0;
  return {
    ...value,
    lessons: value.lessons.slice(0, 10).map((lesson) => {
      if (!lesson || typeof lesson !== 'object') return lesson;
      const item = lesson as Record<string, unknown>;
      const rawUnitCodes = Array.isArray(item.unitCodes) ? item.unitCodes : [];
      return {
        ...item,
        theme: limitText(item.theme, 80),
        content: limitText(item.content, 300),
        difficulty: limitText(item.difficulty, 300),
        goal: limitText(item.goal, 200),
        unitCodes: isApSubject
          ? rawUnitCodes.slice(0, 10).map((code) => normalizeUnitCode(code, allowedUnitCodes))
          : [],
      };
    }),
  };
}
