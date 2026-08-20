function buildGenerationChecklist({ studentName, subjectName, currentScore, targetScore, examDate, totalHours, lessonCount, planningScenarioLabel, planningFocusLabel, teacherName, notesLength }) {
  const hours = Number(totalHours);
  const hasHours = String(totalHours ?? '').trim() !== '' && Number.isFinite(hours) && hours > 0;
  const lessons = Number(lessonCount);
  const hasLessonCount = String(lessonCount ?? '').trim() !== '' && Number.isInteger(lessons) && lessons > 0;
  return [
    { label: '学生', value: studentName || '未填写', status: studentName ? 'ready' : 'warning' },
    { label: '科目', value: subjectName || '未选择', status: subjectName ? 'ready' : 'warning' },
    { label: '当前成绩', value: currentScore || '未填写（可继续）', status: currentScore ? 'ready' : 'optional' },
    { label: '目标成绩', value: targetScore || '未填写（建议确认）', status: targetScore ? 'ready' : 'warning' },
    { label: '考试时间', value: examDate || '未填写（可继续）', status: examDate ? 'ready' : 'optional' },
    { label: '辅导场景', value: planningScenarioLabel || '未选择', status: planningScenarioLabel ? 'ready' : 'warning' },
    { label: '课程侧重点', value: planningFocusLabel || '未选择（可继续）', status: planningFocusLabel ? 'ready' : 'optional' },
    { label: '总课时', value: hasHours ? `${hours}h` : '未填写', status: hasHours ? 'ready' : 'warning' },
    { label: '预计课次', value: hasLessonCount ? `${lessons} 节` : '未填写', status: hasLessonCount ? 'ready' : 'warning' },
    { label: '授课老师', value: teacherName || '当前登录老师', status: 'ready' },
    { label: '试听记录', value: `${Number(notesLength) || 0} 字`, status: Number(notesLength) >= 20 ? 'ready' : 'warning' },
  ];
}

function flattenReportText(report) {
  return JSON.stringify({
    overview: report?.overview,
    classroomStatus: report?.classroomStatus,
    strength: report?.strength,
    currentFocus: report?.currentFocus,
    lessonTitle: report?.lessonTitle,
    lessonSummary: report?.lessonSummary,
    performance: report?.performance,
    outcomes: report?.outcomes,
    priorityAreas: report?.priorityAreas,
    coursePlan: report?.coursePlan,
  });
}

function humanizeReportWarning(value) {
  return String(value || '')
    .replace(/第 (\d+) 节课的内容属于 ([^，]+)，但 unitCodes 未如实标记/g, '系统识别到第 $1 节课的内容涉及$2，但生成结果没有将本节归入该单元，请核对本节主题和内容')
    .replace(/第 (\d+) 节课标记了与明确内容不一致的 Unit：(.+)/g, '第 $1 节课被归入$2，但本节明确内容与该单元不一致，请核对本节主题和内容')
    .replace(/\bcalc_u(10|[1-9])\b/gi, '第 $1 单元')
    .replace(/\bunitCodes\b/gi, '课程单元归属')
    .replace(/Calculus Unit 标记/g, 'AP Calculus 单元归属')
    .replace(/不允许的 Unit：/g, '当前课程不包含的单元：')
    .replace(/必须覆盖的 Unit：/g, '本次必须安排的课程单元：')
    .replace(/额外安排了 Unit：/g, '额外安排了课程单元：');
}

function buildReportQualityChecks({ subjectCode, report, targetScore, requestedTotalHours, layoutWarnings = [], qualityReview = {} }) {
  const lessons = report?.coursePlan?.stages?.flatMap((stage) => stage.lessons || []) || [];
  const plannedHours = lessons.reduce((total, lesson) => total + Number(lesson.duration || 0), 0);
  const requestedHours = Number(requestedTotalHours);
  const hoursMatch = Number.isFinite(requestedHours) && Math.abs(plannedHours - requestedHours) < 0.001;
  const reportText = flattenReportText(report);
  const uncertainWording = /待老师确认|待确认|需老师确认|信息不足|暂无数据|未提供/.test(reportText);
  const reviewCompleted = qualityReview.reviewCompleted === true;
  const subjectScopePassed = reviewCompleted && qualityReview.subjectScopePassed === true;
  const modelWarnings = Array.isArray(qualityReview.modelWarnings) ? qualityReview.modelWarnings : [];
  const criticalWarnings = Array.isArray(qualityReview.criticalWarnings) ? qualityReview.criticalWarnings : [];
  const apSubject = String(subjectCode || '').startsWith('ap_');
  const checks = [
    {
      label: '总课时一致性',
      status: hoursMatch ? 'passed' : 'warning',
      message: hoursMatch ? `规划合计 ${plannedHours}h，与老师填写一致` : `规划合计 ${plannedHours}h，老师填写 ${requestedHours}h`,
    },
    {
      label: '目标成绩',
      status: targetScore ? 'passed' : 'warning',
      message: targetScore ? `${apSubject ? 'AP ' : ''}目标成绩为 ${targetScore}` : '尚未填写目标成绩，建议交付前确认',
    },
    {
      label: '待确认话术',
      status: uncertainWording ? 'warning' : 'passed',
      message: uncertainWording ? '报告中仍有“待确认”或信息不足类表达' : '未发现面向家长的待确认占位话术',
    },
    {
      label: '科目范围',
      status: subjectScopePassed ? 'passed' : 'warning',
      message: subjectScopePassed ? '已通过当前科目的防串科检查' : reviewCompleted ? '发现可能属于其他科目的内容，请检查' : '未经过服务端防串科检查，建议人工复核',
    },
    {
      label: '课堂依据',
      status: report?.teacherNotice ? 'warning' : 'passed',
      message: report?.teacherNotice || '试听记录包含具体课堂内容和学生表现',
    },
    {
      label: '页面排版',
      status: layoutWarnings.length ? 'warning' : 'passed',
      message: layoutWarnings.length ? `有 ${layoutWarnings.length} 项内容较长，建议导出前预览` : '课程规划内容长度处于安全范围',
    },
    {
      label: 'AI 内容质量',
      status: reviewCompleted && !modelWarnings.length && !criticalWarnings.length ? 'passed' : 'warning',
      message: criticalWarnings.length ? `有 ${criticalWarnings.length} 项问题需要老师重点核对` : modelWarnings.length ? `仍有 ${modelWarnings.length} 项内容建议老师复核` : reviewCompleted ? 'AI 内容已通过质量复核' : '本地兜底内容未经过 AI 质量复核',
    },
  ];
  return checks;
}

export { buildGenerationChecklist, buildReportQualityChecks, humanizeReportWarning };
