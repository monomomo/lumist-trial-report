import { z } from 'zod';

export const teacherProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  publicName: z.string().trim().max(60).default(''),
  title: z.string().trim().max(120).default(''),
  summary: z.string().trim().max(500).default(''),
  bio: z.array(z.string().trim().min(1).max(600)).max(20).default([]),
  subjects: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  employmentType: z.enum(['full_time', 'part_time']),
});

export type TeacherFieldError = { field: string; message: string };

export function formatTeacherValidationErrors(issues: z.core.$ZodIssue[], input: unknown): TeacherFieldError[] {
  const labels: Record<string, string> = {
    displayName: '中文姓名', publicName: '报告展示名', title: '展示职位', summary: '简介摘要',
    bio: '老师简介', subjects: '擅长科目', employmentType: '任职类型', username: '登录账号',
    password: '初始密码', teacherId: '老师账号信息', active: '账号状态',
  };
  return issues.map((issue) => {
    const field = String(issue.path[0] || '');
    const value = issue.path.reduce<unknown>((current, key) => current && typeof current === 'object' ? (current as Record<PropertyKey, unknown>)[key] : undefined, input);
    const line = typeof issue.path[1] === 'number' ? `第 ${issue.path[1] + 1} 条` : '';
    const label = `${labels[field] || '老师资料'}${line}`;
    if (issue.code === 'too_big') {
      const array = Array.isArray(value);
      const count = array ? value.length : typeof value === 'string' ? value.trim().length : null;
      const unit = array ? '条' : '字';
      return { field, message: `${label}${count === null ? '' : `当前 ${count} ${unit}，`}最多支持 ${issue.maximum} ${unit}。` };
    }
    if (field === 'employmentType') return { field, message: '请选择任职类型：全职或兼职。' };
    if (field === 'teacherId' || field === 'active') return { field, message: `${label}异常，请关闭编辑窗口后重新打开；若仍失败，请刷新页面重试。` };
    if (issue.code === 'too_small' && field === 'username') return { field, message: '登录账号至少需要 3 个字符。' };
    if (issue.code === 'too_small') return { field, message: `请填写${label}。` };
    return { field, message: `${label}格式不正确，请检查后重试。` };
  });
}
