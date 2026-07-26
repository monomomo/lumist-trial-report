import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeTeacherProfile } from '../public/report/report-domain.js';

test('teacher profile keeps structured multi-teacher presentation fields', () => {
  const profile = normalizeTeacherProfile({
    displayName: 'Cathy',
    title: 'SAT 与 AP 英语导师',
    summary: '注重文本证据与写作表达。',
    bio: ['多年教学经验。'],
    sections: [
      { title: '教学背景', content: ['熟悉北美课程体系。'] },
      { title: '', content: ['不应保留。'] },
    ],
    subjects: ['SAT 英语', 'AP English Language'],
    photoUrl: '/photo.png',
    qrUrl: '/qr.png',
  });

  assert.deepEqual(profile, {
    displayName: 'Cathy',
    displayPlaceholder: 'C',
    title: 'SAT 与 AP 英语导师',
    summary: '注重文本证据与写作表达。',
    bio: ['多年教学经验。'],
    sections: [{ title: '教学背景', content: ['熟悉北美课程体系。'] }],
    subjects: ['SAT 英语', 'AP English Language'],
    photoUrl: '/photo.png',
    qrUrl: '/qr.png',
  });
});

test('teacher page has no Amber or SAT Math presentation hardcoding', async () => {
  const appSource = await readFile(new URL('../public/report/app.js', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../public/report/styles.css', import.meta.url), 'utf8');

  assert.doesNotMatch(styles, /content:"AMBER"/);
  assert.doesNotMatch(styles, /content:"LUMIST · SAT MATH"/);
  assert.match(appSource, /teacher-photo-name/);
  assert.match(appSource, /LUMIST · \$\{escapeHtml\(subjectName\)\}/);
  assert.match(appSource, /teacherProfile\.sections/);
  assert.match(appSource, /teacherProfile\.subjects/);
});

test('report persistence uses a server-resolved teacher snapshot', async () => {
  const routeSource = await readFile(new URL('../app/api/reports/route.ts', import.meta.url), 'utf8');
  const migrationSource = await readFile(new URL('../supabase/migrations/202607270001_multi_teacher_profiles.sql', import.meta.url), 'utf8');

  assert.match(routeSource, /getTeacherProfileSnapshot/);
  assert.match(routeSource, /teacher_snapshot: teacherSnapshot \|\| \{\}/);
  assert.match(routeSource, /error\?\.message\.includes\('teacher_snapshot'\)/);
  assert.match(routeSource, /insert\(legacyPayload\)/);
  assert.match(migrationSource, /create table if not exists public\.teacher_configs/);
  assert.match(migrationSource, /create table if not exists public\.reports/);
  assert.match(migrationSource, /add column if not exists teacher_snapshot jsonb/);
  assert.match(migrationSource, /add column if not exists sections jsonb/);
  assert.match(migrationSource, /add column if not exists subjects jsonb/);
  assert.match(migrationSource, /lumist_teacher_configs_select_own/);
  assert.match(migrationSource, /b7ec88c5-447e-4f9b-88ea-34f59fa3db03/);
});
