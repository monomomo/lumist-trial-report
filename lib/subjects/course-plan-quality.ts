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

export function getCoursePlanQualityIssues(report: CoursePlanQualityReport, subjectCode: string) {
  if (subjectCode !== 'sat_math') return [];
  const stages = report.coursePlan?.stages ?? [];
  const lessons = stages.flatMap((stage) => stage.lessons ?? []);
  const issues: string[] = [];
  const templatedTitles = [
    ...stages.map((stage) => stage.title ?? ''),
    ...lessons.map((lesson) => lesson.theme ?? ''),
  ].filter((value) => TEMPLATE_TITLE_PATTERN.test(value)).length;
  const genericDifficulties = lessons.filter((lesson) => GENERIC_DIFFICULTY_PATTERN.test(lesson.difficulty?.trim() ?? '')).length;
  const planText = lessons.map((lesson) => `${lesson.theme ?? ''} ${lesson.content ?? ''} ${lesson.goal ?? ''}`).join(' ');

  if (templatedTitles >= 2) issues.push('阶段或课时标题大量使用“系统学习、夯实、强化、突破、闭环”等模板词');
  if (lessons.length >= 4 && genericDifficulties >= Math.ceil(lessons.length / 2)) {
    issues.push('多数 difficulty 只写“基础、中等、偏难”，没有指出具体易错点');
  }
  if (lessons.length >= 8 && !/Bluebook|Student Question Bank|Educator Question Bank|My Practice|官方题库/i.test(planText)) {
    issues.push('较长的 SAT 数学规划没有安排官方诊断或按技能筛题的练习节点');
  }
  return issues;
}
