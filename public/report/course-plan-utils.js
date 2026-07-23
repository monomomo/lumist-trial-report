const ALLOWED_DURATIONS = [0.5, 1, 1.5, 2];

function cloneCoursePlan(coursePlan) {
  return JSON.parse(JSON.stringify(coursePlan));
}

function calculateTotalHours(coursePlan) {
  return coursePlan.stages.reduce((total, stage) => total + stage.lessons.reduce((stageTotal, lesson) => stageTotal + Number(lesson.duration || 0), 0), 0);
}

function validateCoursePlan(coursePlan) {
  const errors = [];
  const warnings = [];
  const lessonLimits = { theme: 60, content: 300, goal: 180, difficulty: 180 };
  if (!coursePlan.stages.length) errors.push({ path: 'stages', message: '课程规划至少需要一个阶段' });
  coursePlan.stages.forEach((stage, stageIndex) => {
    const title = String(stage.title || '');
    const description = String(stage.description || '');
    if (!title.trim()) errors.push({ path: `stages.${stageIndex}.title`, message: '请填写阶段名称' });
    if (title.length > 50) warnings.push({ path: `stages.${stageIndex}.title`, message: '阶段名称超过 50 字，可能影响报告排版' });
    if (description.length > 160) warnings.push({ path: `stages.${stageIndex}.description`, message: '阶段说明超过 160 字，可能影响报告排版' });
    if (!stage.lessons.length) errors.push({ path: `stages.${stageIndex}.lessons`, message: '每个阶段至少需要一个课时' });
    stage.lessons.forEach((lesson, lessonIndex) => {
      if (!ALLOWED_DURATIONS.includes(Number(lesson.duration))) errors.push({ path: `stages.${stageIndex}.lessons.${lessonIndex}.duration`, message: '课时时长仅支持 0.5、1、1.5 或 2 小时' });
      Object.entries(lessonLimits).forEach(([field, limit]) => {
        const value = String(lesson[field] || '');
        const path = `stages.${stageIndex}.lessons.${lessonIndex}.${field}`;
        if (!value.trim()) errors.push({ path, message: `请填写${{ theme: '课时主题', content: '课堂内容', goal: '当课目标', difficulty: '重难点' }[field]}` });
        if (value.length > limit) warnings.push({ path, message: `${{ theme: '课时主题', content: '课堂内容', goal: '当课目标', difficulty: '重难点' }[field]}超过 ${limit} 字，可能影响报告排版` });
      });
    });
  });
  return { valid: errors.length === 0, errors, warnings };
}

function rebalanceFinalPage(pageGroups, canFit) {
  const result = pageGroups.map((group) => group.slice());
  let moved;
  do {
    moved = false;
    for (let pageIndex = result.length - 1; pageIndex > 0; pageIndex -= 1) {
      while (result[pageIndex].length < 2 && result[pageIndex - 1].length > 1) {
        const candidate = result[pageIndex - 1].at(-1);
        const targetRows = [candidate, ...result[pageIndex]];
        if (!canFit(pageIndex, targetRows)) break;
        result[pageIndex - 1].pop();
        result[pageIndex] = targetRows;
        moved = true;
      }
    }
  } while (moved);
  return result;
}

function moveItem(items, fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return items.slice();
  const result = items.slice();
  const [item] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, item);
  return result;
}

function moveLesson(coursePlan, fromStageIndex, lessonIndex, toStageIndex, toIndex) {
  const result = cloneCoursePlan(coursePlan);
  const sourceLessons = result.stages[fromStageIndex].lessons;
  const [lesson] = sourceLessons.splice(lessonIndex, 1);
  const targetLessons = result.stages[toStageIndex].lessons;
  targetLessons.splice(Math.max(0, Math.min(toIndex, targetLessons.length)), 0, lesson);
  result.totalHours = calculateTotalHours(result);
  return result;
}

function createLesson() {
  return { duration: 1, theme: '', content: '', goal: '', difficulty: '' };
}

function createStage() {
  return { title: '新阶段', description: '', lessons: [createLesson()] };
}

export { ALLOWED_DURATIONS, cloneCoursePlan, calculateTotalHours, validateCoursePlan, moveItem, moveLesson, rebalanceFinalPage, createStage, createLesson };
