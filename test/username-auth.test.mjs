import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  TEACHER_AUTH_DOMAIN,
  authEmailToUsername,
  isValidUsername,
  normalizeUsername,
  usernameToAuthEmail,
} from '../lib/auth/username.ts';

test('teacher usernames normalize to private Supabase auth emails', () => {
  assert.equal(normalizeUsername(' AmberLyu '), 'amberlyu');
  assert.equal(usernameToAuthEmail(' AmberLyu '), `amberlyu@${TEACHER_AUTH_DOMAIN}`);
  assert.equal(authEmailToUsername(`amberlyu@${TEACHER_AUTH_DOMAIN}`), 'amberlyu');
});

test('teacher usernames reject unsupported or unsafe formats', () => {
  for (const username of ['', 'ab', 'Amber Lyu', 'amber@lumist.com', '安老师']) {
    assert.equal(isValidUsername(username), false);
    assert.throws(() => usernameToAuthEmail(username), /INVALID_USERNAME/);
  }
  assert.equal(isValidUsername('teacher_li-01'), true);
});

test('login form presents username credentials instead of email', async () => {
  const source = await readFile(new URL('../components/LoginForm.tsx', import.meta.url), 'utf8');
  assert.match(source, /老师账号/);
  assert.match(source, /usernameToAuthEmail/);
  assert.equal(source.includes('type="email"'), false);
  assert.equal(source.includes('工作邮箱'), false);
});

test('Amber preset profile contains the supplied AP credentials and portrait', async () => {
  const source = await readFile(new URL('../lib/teachers/public-profile.ts', import.meta.url), 'utf8');
  assert.match(source, /amberlyu/);
  assert.match(source, /AP 数学与计算机课程导师/);
  assert.match(source, /佐治亚理工大学计算机硕士/);
  assert.match(source, /amberlyu-photo\.png/);
});
