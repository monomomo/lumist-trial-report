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
  assert.match(dashboard, /中文姓名/);
  assert.match(dashboard, /chineseName\(teacher\.displayName\) \|\| '未填写'/);
  assert.match(dashboard, /全职/);
  assert.match(dashboard, /兼职/);
  assert.match(dashboard, /授课视频二维码/);
  assert.match(dashboard, /teacher-editor-backdrop/);
  assert.match(dashboard, /aria-modal="true"/);
  assert.match(dashboard, /event\.key === 'Escape'/);
});

test('teacher sync stores the Chinese source name separately from the report name', async () => {
  const source = await readFile(new URL('../scripts/sync-feishu-teachers.mjs', import.meta.url), 'utf8');
  assert.match(source, /display_name: chineseName\(teacher\.name\)/);
  assert.match(source, /public_name: profile\.publicName/);
});

test('management teacher assets are validated and stored privately', async () => {
  const route = await readFile(new URL('../app/api/management/teachers/assets/route.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../supabase/migrations/202609190001_teacher_employment_type.sql', import.meta.url), 'utf8');
  assert.match(route, /teacher-assets/);
  assert.match(route, /image\/jpeg/);
  assert.match(route, /5 \* 1024 \* 1024/);
  assert.match(route, /3 \* 1024 \* 1024/);
  assert.match(migration, /employment_type in \('full_time', 'part_time'\)/);
});

test('teacher creation only requires a username and teacher name', async () => {
  const route = await readFile(new URL('../app/api/management/teachers/route.ts', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../components/ManagementDashboard.tsx', import.meta.url), 'utf8');
  assert.match(route, /const password = parsed\.data\.password \|\| '123456'/);
  assert.match(route, /const publicName = parsed\.data\.publicName \|\| parsed\.data\.displayName/);
  assert.match(dashboard, /初始密码（选填）/);
  assert.match(dashboard, /报告展示名（选填）/);
});
