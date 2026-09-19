import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getRegistrationRole, matchesRegistrationCode } from '../lib/auth/registration.ts';

test('registration only accepts management and sales roles', () => {
  assert.equal(getRegistrationRole('management'), 'management');
  assert.equal(getRegistrationRole('sales'), 'sales');
  assert.equal(getRegistrationRole('teacher'), null);
});

test('registration code comparison rejects blank or different codes', () => {
  assert.equal(matchesRegistrationCode('Staff-Invite-2026', 'Staff-Invite-2026'), true);
  assert.equal(matchesRegistrationCode('Staff-Invite-2026', 'Sales-Invite-2026'), false);
  assert.equal(matchesRegistrationCode('', ''), false);
});

test('registration page keeps teacher accounts out of self-service signup', async () => {
  const page = await readFile(new URL('../app/register/page.tsx', import.meta.url), 'utf8');
  const form = await readFile(new URL('../components/RegisterForm.tsx', import.meta.url), 'utf8');
  assert.match(page, /老师账号由师资管理人员创建/);
  assert.match(form, /management/);
  assert.match(form, /sales/);
  assert.doesNotMatch(form, /teacher/);
});

test('registration API uses server-only invite codes and privileged account creation', async () => {
  const route = await readFile(new URL('../app/api/register/route.ts', import.meta.url), 'utf8');
  const registration = await readFile(new URL('../lib/auth/registration.ts', import.meta.url), 'utf8');
  assert.match(registration, /STAFF_MANAGEMENT_REGISTRATION_CODE/);
  assert.match(registration, /SALES_REGISTRATION_CODE/);
  assert.match(route, /createAdminClient/);
  assert.match(route, /email_confirm: true/);
  assert.match(route, /profileRole = role === 'management' \? 'admin' : 'sales'/);
});

test('management dashboard supports searching filtering sorting and pagination', async () => {
  const dashboard = await readFile(new URL('../components/ManagementDashboard.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /姓名、账号、职位或科目/);
  assert.match(dashboard, /全部状态/);
  assert.match(dashboard, /全部科目/);
  assert.match(dashboard, /按展示名/);
  assert.match(dashboard, /PAGE_SIZE/);
});
