export const MIN_TEACHER_PASSWORD_LENGTH = 6;

export function getTeacherPasswordError(value: string) {
  if (value.length < MIN_TEACHER_PASSWORD_LENGTH) return '新密码至少需要 6 位。';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return '新密码需要同时包含字母和数字。';
  return null;
}
