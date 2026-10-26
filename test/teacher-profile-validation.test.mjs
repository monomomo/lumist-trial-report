import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherProfileSchema, formatTeacherValidationErrors } from '../lib/teachers/profile-validation.ts';

const valid = { displayName: '测试老师', publicName: '', title: '', summary: '', bio: [], subjects: [], employmentType: 'full_time' };
function errors(input) {
  const result = teacherProfileSchema.safeParse(input);
  assert.equal(result.success, false);
  return formatTeacherValidationErrors(result.error.issues, input);
}

test('teacher profile errors identify too many bio entries and their actual count', () => {
  const issues = errors({ ...valid, bio: Array(25).fill('教学经历') });
  assert.deepEqual(issues, [{ field: 'bio', message: '老师简介当前 25 条，最多支持 20 条。' }]);
});

test('teacher profile errors identify the exact oversized bio entry', () => {
  const issues = errors({ ...valid, bio: ['教学经历', '数学'.repeat(301)] });
  assert.deepEqual(issues, [{ field: 'bio', message: '老师简介第 2 条当前 602 字，最多支持 600 字。' }]);
});

test('teacher profile reports all failing fields rather than a missing-information message', () => {
  const issues = errors({ ...valid, summary: '文'.repeat(501), subjects: Array(21).fill('SAT Math') });
  assert.deepEqual(issues.map((issue) => issue.field), ['summary', 'subjects']);
  assert.match(issues[0].message, /501 字.*500 字/);
  assert.match(issues[1].message, /21 条.*20 条/);
});

test('teacher profile validation shares exact length limits and keeps whitespace normalization', () => {
  assert.equal(teacherProfileSchema.safeParse({ ...valid, summary: '文'.repeat(500), bio: Array(20).fill('文'.repeat(600)) }).success, true);
  assert.equal(teacherProfileSchema.parse({ ...valid, displayName: ' 测试老师 ' }).displayName, '测试老师');
  assert.equal(errors({ ...valid, displayName: '   ' })[0].message, '请填写中文姓名。');
  assert.match(errors({ ...valid, employmentType: null })[0].message, /请选择任职类型/);
});

test('technical account errors explain recovery without blaming profile contents', () => {
  const issues = formatTeacherValidationErrors([
    { code: 'invalid_type', expected: 'boolean', path: ['active'], message: 'Invalid input' },
  ], {});
  assert.equal(issues[0].field, 'active');
  assert.match(issues[0].message, /账号状态异常.*重新打开/);
});
