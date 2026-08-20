import test from 'node:test';
import assert from 'node:assert/strict';
import { getGenerationFailureDetails } from '../lib/reports/generation-failures.ts';

test('generation failure details expose a safe course wording reason and action', () => {
  const details = getGenerationFailureDetails('COURSE_PLAN_STYLE_REPETITION', [
    '第 2–4 课的课程目标连续以“能够”开头，呈现大纲式重复句型',
  ]);
  assert.equal(details.reason, '第 2–4 课的课程目标连续以“能够”开头，呈现大纲式重复句型');
  assert.match(details.suggestion, /自动修复一次/);
  assert.equal(JSON.stringify(details).includes('teacherNotes'), false);
});

test('generation failure details fall back to a stable public message', () => {
  const details = getGenerationFailureDetails('UNKNOWN_INTERNAL_CODE');
  assert.match(details.reason, /没有完成报告生成/);
  assert.match(details.suggestion, /参考编号/);
});

test('generation failure details explain missing login infrastructure', () => {
  const details = getGenerationFailureDetails('SYSTEM_NOT_CONFIGURED');
  assert.match(details.reason, /登录与数据服务/);
  assert.match(details.suggestion, /本地兜底/);
});
