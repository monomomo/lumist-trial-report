type ReportSummary = {
  classroomStatus: string;
  strength: string;
  lessonTitle: string;
  lessonSummary: string;
  performance: string;
  outcomes: string[];
};

export function hasDirectClassroomEvidence(notes: string) {
  return /课堂上|试听课|本节课|学生(?:独立|主动|正确|错误|完成|回答|作答|计算|写出|说出|指出|修正|订正)|正确率|准确率|做对|做错|提示后|引导后|讲解后|用时\s*\d|\d+\s*(?:分钟|秒)/.test(notes);
}

export function applyClassroomFactGuard<T extends ReportSummary>(report: T, subjectName: string, notes: string): T {
  if (hasDirectClassroomEvidence(notes)) return report;
  return {
    ...report,
    classroomStatus: '本次先围绕当前校内进度、近期学习安排和后续补习方向进行了沟通，具体作答过程将在后续练习中继续观察。',
    strength: '现阶段已经明确校内进度、近期测验安排和主要学习困难，为后续同步补习与查漏补缺提供了清晰方向。',
    lessonTitle: `${subjectName}学习进度与后续课程安排`,
    lessonSummary: `本次主要沟通了学生当前的 ${subjectName} 校内进度、近期学习任务和后续课程目标，并据此确定同步补习与查漏补缺的安排。`,
    performance: '本次以学习情况沟通和课程衔接为主，后续将结合具体题目观察概念理解、方法选择、英文题干处理和完整作答过程。',
    outcomes: [
      '明确当前校内学习进度和近期测验安排',
      '明确现阶段需要优先补齐基础概念与题型应用',
      '确定后续以同步补习和持续查漏补缺为主线',
    ],
  };
}
