export const SUMMARY_FIELD_RULES = {
  overview: { label: '本次试听结论', maximum: 500 },
  classroomStatus: { label: '课堂状态', maximum: 160 },
  strength: { label: '已体现优势', maximum: 160 },
  currentFocus: { label: '当前重点', maximum: 180 },
  lessonTitle: { label: '试听内容标题', maximum: 80 },
  lessonSummary: { label: '试听内容说明', maximum: 400 },
  performance: { label: '学生表现', maximum: 300 },
};

export function cloneReportSummary(report) {
  return {
    overview: String(report?.overview || ''),
    classroomStatus: String(report?.classroomStatus || ''),
    strength: String(report?.strength || ''),
    currentFocus: String(report?.currentFocus || ''),
    lessonTitle: String(report?.lessonTitle || ''),
    lessonSummary: String(report?.lessonSummary || ''),
    performance: String(report?.performance || ''),
    outcomes: Array.isArray(report?.outcomes) ? report.outcomes.map(String) : [],
    priorityAreas: Array.isArray(report?.priorityAreas) ? report.priorityAreas.map(String) : [],
  };
}

export function validateReportSummary(summary) {
  const errors = [];
  Object.entries(SUMMARY_FIELD_RULES).forEach(([field, rule]) => {
    const value = String(summary?.[field] || '').trim();
    if (!value) errors.push({ path: field, message: `${rule.label}不能为空` });
    else if (value.length > rule.maximum) errors.push({ path: field, message: `${rule.label}不能超过 ${rule.maximum} 字` });
  });
  validateList(summary?.outcomes, 'outcomes', '本节课收获', 1, 5, 120, errors);
  validateList(summary?.priorityAreas, 'priorityAreas', '优先提升内容', 1, 6, 80, errors);
  return { valid: errors.length === 0, errors };
}

function validateList(items, path, label, minimum, maximum, itemMaximum, errors) {
  if (!Array.isArray(items) || items.length < minimum) {
    errors.push({ path, message: `${label}至少保留 ${minimum} 项` });
    return;
  }
  if (items.length > maximum) errors.push({ path, message: `${label}最多保留 ${maximum} 项` });
  items.forEach((item, index) => {
    const value = String(item || '').trim();
    if (!value) errors.push({ path: `${path}.${index}`, message: `${label}第 ${index + 1} 项不能为空` });
    else if (value.length > itemMaximum) errors.push({ path: `${path}.${index}`, message: `${label}第 ${index + 1} 项不能超过 ${itemMaximum} 字` });
  });
}
