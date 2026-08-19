interface CoursePlanQualityReport {
  lessonTitle?: string;
  lessonSummary?: string;
  coursePlan?: {
    stages?: Array<{
      title?: string;
      lessons?: Array<{
        theme?: string;
        content?: string;
        difficulty?: string;
        goal?: string;
      }>;
    }>;
  };
}

const TEMPLATE_TITLE_PATTERN = /^(系统学习|夯实|强化|专项突破|综合提升|能力提升|高分冲刺|考前闭环|知识框架)/;
const GENERIC_DIFFICULTY_PATTERN = /^(基础|中等|困难|偏难|中等偏上|基础[—至-]|中等[—至-])/;
const GENERIC_GOAL_PATTERN = /^(掌握|提升|建立|巩固|熟悉|强化)(?!.*(?:能识别|能解释|能选择|能写出|能调试|能判断|能完成|能订正|作答|代码|图|步骤|依据))/;
const SAT_EVIDENCE_PATTERN = /Bluebook|Student Question Bank|Educator Question Bank|My Practice|官方题库/i;
const AP_EVIDENCE_PATTERN = /AP Classroom|Topic Questions?|Progress Checks?|Question Bank|Practice Exam|MCQ|FRQ|scoring guidelines?|评分标准|真题/i;
const INTRODUCTION_PATTERN = /导入|课程框架|核心术语|术语适应|课程衔接/;
const OUTLINE_OPENERS = [
  ['能够', /^(?:本节课(?:中)?|课后|学生)?\s*能够/],
  ['通过', /^(?:本节课(?:中)?|课后|学生)?\s*通过/],
  ['完成', /^(?:本节课(?:中)?|课后|学生)?\s*完成/],
] as const;

function getOutlineOpener(value: string) {
  return OUTLINE_OPENERS.find(([, pattern]) => pattern.test(value.trim()))?.[0] ?? null;
}

function getConsecutiveRun(openers: Array<string | null>, sameOpener: boolean, minimum: number) {
  for (let start = 0; start < openers.length; start += 1) {
    if (!openers[start]) continue;
    let end = start + 1;
    while (end < openers.length && openers[end] && (!sameOpener || openers[end] === openers[start])) end += 1;
    if (end - start >= minimum) return { start, end, opener: openers[start] };
    start = end - 1;
  }
  return null;
}

export function getCoursePlanWordingIssues(report: CoursePlanQualityReport) {
  const lessons = (report.coursePlan?.stages ?? []).flatMap((stage) => stage.lessons ?? []);
  const issues: string[] = [];
  for (const field of ['content', 'goal'] as const) {
    const fieldLabel = field === 'content' ? '授课内容' : '课程目标';
    const openers = lessons.map((lesson) => getOutlineOpener(lesson[field] ?? ''));
    const repeatedRun = getConsecutiveRun(openers, true, 3);
    if (repeatedRun) {
      issues.push(`第 ${repeatedRun.start + 1}–${repeatedRun.end} 课的${fieldLabel}连续以“${repeatedRun.opener}”开头，呈现大纲式重复句型`);
      continue;
    }
    const outlineRun = getConsecutiveRun(openers, false, 4);
    if (outlineRun) {
      issues.push(`第 ${outlineRun.start + 1}–${outlineRun.end} 课的${fieldLabel}连续使用“能够、通过、完成”等大纲式句型`);
      continue;
    }
    if (lessons.length >= 6) {
      const repeated = OUTLINE_OPENERS
        .map(([opener]) => ({ opener, count: openers.filter((value) => value === opener).length }))
        .find(({ count }) => count >= Math.max(3, Math.ceil(lessons.length * 0.4)));
      if (repeated) issues.push(`${lessons.length} 节课中有 ${repeated.count} 个${fieldLabel}以“${repeated.opener}”开头，句式变化不足`);
    }
  }
  return issues;
}

export function getCoursePlanQualityIssues(report: CoursePlanQualityReport, subjectCode: string, expectedLessonCount?: number) {
  const stages = report.coursePlan?.stages ?? [];
  const lessons = stages.flatMap((stage) => stage.lessons ?? []);
  const issues: string[] = [];
  const templatedTitles = [
    ...stages.map((stage) => stage.title ?? ''),
    ...lessons.map((lesson) => lesson.theme ?? ''),
  ].filter((value) => TEMPLATE_TITLE_PATTERN.test(value)).length;
  const genericDifficulties = lessons.filter((lesson) => GENERIC_DIFFICULTY_PATTERN.test(lesson.difficulty?.trim() ?? '')).length;
  const genericGoals = lessons.filter((lesson) => GENERIC_GOAL_PATTERN.test(lesson.goal?.trim() ?? '')).length;
  const planText = stages.map((stage) => [
    stage.title ?? '',
    ...(stage.lessons ?? []).flatMap((lesson) => [
      lesson.theme ?? '',
      lesson.content ?? '',
      lesson.difficulty ?? '',
      lesson.goal ?? '',
    ]),
  ].join(' ')).join(' ');

  if (templatedTitles >= 2) issues.push('阶段或课时标题大量使用“系统学习、夯实、强化、突破、闭环”等模板词');
  if (lessons.length >= 4 && genericDifficulties >= Math.ceil(lessons.length / 2)) {
    issues.push('多数 difficulty 只写“基础、中等、偏难”，没有指出具体易错点');
  }
  if (lessons.length >= 4 && genericGoals >= Math.ceil(lessons.length / 2)) {
    issues.push('多数 goal 只写“掌握、提升、巩固”等抽象结果，无法在课后核对');
  }
  if (lessons.length >= 8 && subjectCode.startsWith('sat_') && !SAT_EVIDENCE_PATTERN.test(planText)) {
    issues.push('较长的 SAT 规划没有安排官方诊断或按技能筛题的练习节点');
  }
  if (lessons.length >= 8 && subjectCode.startsWith('ap_') && !AP_EVIDENCE_PATTERN.test(planText)) {
    issues.push('较长的 AP 规划没有安排 AP 题型、官方资源或可复核的作答证据');
  }
  if (expectedLessonCount !== undefined && lessons.length !== expectedLessonCount) {
    issues.push(`课程规划必须包含 ${expectedLessonCount} 个课时块，当前生成了 ${lessons.length} 个`);
  }
  const trialText = `${report.lessonTitle ?? ''} ${report.lessonSummary ?? ''}`;
  const firstLesson = lessons[0];
  const firstLessonText = `${firstLesson?.theme ?? ''} ${firstLesson?.content ?? ''}`;
  if (INTRODUCTION_PATTERN.test(trialText) && INTRODUCTION_PATTERN.test(firstLessonText)) {
    issues.push('正式课程第 1 课重复试听课的课程框架或术语导入，应直接承接试听结论进入诊断或具体教学任务');
  }
  issues.push(...getCoursePlanWordingIssues(report));
  return issues;
}
