interface CoursePlanQualityReport {
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

export function getCoursePlanQualityIssues(report: CoursePlanQualityReport, subjectCode: string) {
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
  return issues;
}
