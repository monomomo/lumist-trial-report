import type { SubjectDefinition } from './catalog.js';

/** 生成报告时允许注入的用户输入。 */
export interface ReportPromptData {
  studentName: string;
  currentScore?: string | number | null;
  targetScore?: string | number | null;
  examDate?: string | null;
  teacherNotes: string;
}

/**
 * 构建科目隔离的系统提示词，统一事实边界、专业语气、动态课时和标题规范。
 */
export function buildSystemPrompt(subject: SubjectDefinition): string {
  const modules = subject.modules.join('、');
  return `你是路觅教育的资深 ${subject.displayName} 教研老师。你的任务是把老师的自然语言试听课记录整理成专业、克制、可直接交付家长的学情报告，并生成供销售内部使用的跟进建议。

必须遵守：
1. 只把输入中明确出现的信息写成已知事实，不编造成绩、考试日期、正确率、诊断结果或课堂活动。
2. 区分“本次课堂观察”和“后续建议”，不得把一次试听表现等同于正式考试能力；未知信息应明确建议后续诊断确认。
3. 家长报告使用专业、清晰、鼓励但不过度承诺的语气；销售建议不得承诺具体提分结果或制造焦虑。
4. 课程规划仅针对 ${subject.displayName}，只可使用本学科模块：${modules}。不得加入其他 SAT 或 AP 科目的知识模块。
5. 总课时必须由当前水平、目标成绩、考试日期和薄弱点综合决定，不得预设固定总课时；每个课时块可为 0.5、1、1.5 或 2 小时。
6. 每个课时块必须写明主题、授课内容、重难点和目标，避免把“查漏补缺”等空话单独成项。
7. coursePlan.rationale 只说明动态调整依据，不得出现固定总课时数字或另一套课时方案；系统会根据 lesson.duration 汇总唯一总课时。
8. 每个阶段标题和课时主题必须是语义完整的短句，不得以顿号、逗号、斜杠或未闭合括号结尾。
9. 使用自然、具体的中文，必要时保留 ${subject.displayName} 的标准英文术语。
10. 科目事实边界：${subject.promptContext}`;
}

/**
 * 将学生资料转换为科目明确的用户提示词；空成绩和日期统一标记为未提供。
 */
export function buildUserInput(subject: SubjectDefinition, data: ReportPromptData): string {
  return `请根据以下信息生成 ${subject.displayName} 试听课报告：

学生姓名：${data.studentName}
当前${subject.scoreLabel}：${formatOptional(data.currentScore)}
目标${subject.scoreLabel}：${formatOptional(data.targetScore)}
目标考试日期：${formatOptional(data.examDate)}
课程模块范围：${subject.modules.join('、')}

老师原始记录：
${data.teacherNotes}`;
}

/** 将可选输入格式化为稳定的提示词占位文本。 */
function formatOptional(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '未提供';
  if (typeof value === 'string' && value.trim() === '') return '未提供';
  return String(value);
}
