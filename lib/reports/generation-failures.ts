function firstIssue(issues: readonly unknown[]) {
  return issues.find((issue): issue is string => typeof issue === 'string' && issue.trim().length > 0)?.trim();
}

export function getGenerationFailureDetails(errorCode: string, issues: readonly unknown[] = []) {
  const issue = firstIssue(issues);
  switch (errorCode) {
    case 'INVALID_INPUT':
      return { reason: '填写的信息不完整或格式不正确。', suggestion: '请检查学生姓名、总课时、预计课次和至少 20 个字的课堂记录。' };
    case 'INVALID_SCORE':
      return { reason: '当前成绩或目标成绩不符合所选科目的分数范围。', suggestion: '请返回表单检查成绩，或暂时留空后重新生成。' };
    case 'INVALID_LESSON_COUNT':
      return { reason: '预计课次与总课时无法组成每节 0.5–2 小时的课程。', suggestion: '请调整预计课次或总课时后重新生成。' };
    case 'INVALID_PLANNING_FOCUS':
      return { reason: '所选课程侧重点不适用于当前科目。', suggestion: '请重新选择科目对应的侧重点，最多选择 3 项。' };
    case 'COURSE_PLAN_STYLE_REPETITION':
      return { reason: issue || '连续课时使用了重复的大纲式句型。', suggestion: '系统已经自动修复一次仍未通过，请重新生成；如果反复出现，请把参考编号发给管理员。' };
    case 'SYLLABUS_COVERAGE_VIOLATION':
      return { reason: issue || '课程规划未通过 AP Calculus 官方 Unit 校验。', suggestion: '请检查辅导场景和课堂记录中的 Unit 信息后重新生成。' };
    case 'SUBJECT_SCOPE_VIOLATION':
      return { reason: '课程规划混入了当前科目范围之外的内容。', suggestion: '请确认所选科目与课堂记录一致后重新生成。' };
    case 'UNEXPECTED_LANGUAGE':
      return { reason: '报告混入了中文、英文和数学符号之外的异常文字。', suggestion: '系统已经自动修复一次仍未通过，请重新生成或把参考编号发给管理员。' };
    case 'REPORT_QUALITY_FAILED':
      return { reason: issue || '报告结构连续两次未达到质量要求。', suggestion: '请重新生成；如果反复出现，请把参考编号发给管理员。' };
    case 'EMPTY_MODEL_OUTPUT':
      return { reason: 'AI 本次没有返回可用报告。', suggestion: '请稍后重新生成；如果反复出现，请把参考编号发给管理员。' };
    case 'AI_SERVICE_NOT_CONFIGURED':
      return { reason: 'AI 服务当前不可用。', suggestion: '请联系管理员检查服务配置后重新生成。' };
    case 'SYSTEM_NOT_CONFIGURED':
      return { reason: '登录与数据服务当前不可用。', suggestion: '请联系管理员检查服务配置后重新生成。' };
    case 'UNAUTHORIZED':
      return { reason: '登录状态已失效。', suggestion: '请刷新页面并重新登录。' };
    default:
      return { reason: 'AI 服务本次没有完成报告生成。', suggestion: '请稍后重试；如果反复出现，请把参考编号发给管理员。' };
  }
}
