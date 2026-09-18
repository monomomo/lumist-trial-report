import { timingSafeEqual } from 'node:crypto';

export const REGISTRATION_ROLES = ['management', 'sales'] as const;
export type RegistrationRole = (typeof REGISTRATION_ROLES)[number];

export function getRegistrationRole(value: string): RegistrationRole | null {
  return REGISTRATION_ROLES.includes(value as RegistrationRole) ? value as RegistrationRole : null;
}

export function getRegistrationCode(role: RegistrationRole) {
  return role === 'management'
    ? process.env.STAFF_MANAGEMENT_REGISTRATION_CODE || ''
    : process.env.SALES_REGISTRATION_CODE || '';
}

export function matchesRegistrationCode(input: string, expected: string) {
  const inputBuffer = Buffer.from(input.trim());
  const expectedBuffer = Buffer.from(expected.trim());
  if (!inputBuffer.length || inputBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(inputBuffer, expectedBuffer);
}
