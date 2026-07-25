export const TEACHER_AUTH_DOMAIN = 'teachers.lumist.internal';

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizeUsername(value));
}

export function usernameToAuthEmail(value: string) {
  const username = normalizeUsername(value);
  if (!isValidUsername(username)) throw new Error('INVALID_USERNAME');
  return `${username}@${TEACHER_AUTH_DOMAIN}`;
}

export function authEmailToUsername(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const suffix = `@${TEACHER_AUTH_DOMAIN}`;
  if (normalizedEmail.endsWith(suffix)) return normalizedEmail.slice(0, -suffix.length);
  return normalizedEmail.includes('@') ? normalizedEmail.split('@')[0] : normalizedEmail;
}
